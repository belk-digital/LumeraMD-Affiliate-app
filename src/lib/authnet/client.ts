import crypto from "node:crypto";

// Authorize.net, kept to what memberships need: a hosted payment page for the first month (card
// details never touch this server), a monthly subscription for renewals, and webhook checks.
// AUTHNET_ENV=sandbox (default) talks to the test servers; "production" talks to the real ones.

type Json = Record<string, unknown>;

export class AuthnetError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

const isProduction = () => process.env.AUTHNET_ENV === "production";

const apiUrl = () =>
  isProduction() ? "https://api.authorize.net/xml/v1/request.api" : "https://apitest.authorize.net/xml/v1/request.api";

/** The page a member is sent to (by form POST with the token) to enter their card. */
export const hostedPageUrl = () =>
  isProduction() ? "https://accept.authorize.net/payment/payment" : "https://test.authorize.net/payment/payment";

export function authnetConfigured(): boolean {
  return Boolean(process.env.AUTHNET_API_LOGIN_ID && process.env.AUTHNET_TRANSACTION_KEY);
}

async function call(name: string, payload: Json): Promise<Json> {
  if (!authnetConfigured()) throw new AuthnetError("Authorize.net is not configured.");
  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      [name]: {
        merchantAuthentication: {
          name: process.env.AUTHNET_API_LOGIN_ID,
          transactionKey: process.env.AUTHNET_TRANSACTION_KEY,
        },
        ...payload,
      },
    }),
  });
  // The response starts with a byte-order mark that JSON.parse rejects.
  const data = JSON.parse((await res.text()).replace(/^﻿/, "")) as Json;
  const messages = data.messages as { resultCode?: string; message?: { code: string; text: string }[] } | undefined;
  if (!res.ok || messages?.resultCode !== "Ok") {
    const first = messages?.message?.[0];
    throw new AuthnetError(first?.text ?? `Authorize.net request failed (${res.status}).`, first?.code);
  }
  return data;
}

/** The tag we put on every charge so a payment can be traced back to its member. */
export const customerTag = (customerId: string) => `lumera:${customerId}`;
export const customerIdFromTag = (tag: string | undefined | null) =>
  tag?.startsWith("lumera:") ? tag.slice("lumera:".length) : null;

/** A one-time token for the hosted payment page, good for the first month's charge. */
export async function createHostedPaymentToken(params: {
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const setting = (settingName: string, value: Json) => ({ settingName, settingValue: JSON.stringify(value) });
  // Authorize.net refuses a localhost return address, so a local test server just gets no
  // "Continue" button on the payment page. Real sites always have a public address.
  const publicReturn = !/^https?:\/\/(localhost|127\.|\[::1\])/i.test(params.returnUrl);
  const data = await call("getHostedPaymentPageRequest", {
    transactionRequest: {
      transactionType: "authCaptureTransaction",
      amount: params.amount.toFixed(2),
      order: { description: customerTag(params.customerId).slice(0, 255) },
      customer: { email: params.email },
      billTo: { firstName: params.firstName.slice(0, 50), lastName: params.lastName.slice(0, 50) },
    },
    hostedPaymentSettings: {
      setting: [
        ...(publicReturn
          ? [
              setting("hostedPaymentReturnOptions", {
                showReceipt: false,
                url: params.returnUrl,
                urlText: "Continue",
                cancelUrl: params.cancelUrl,
                cancelUrlText: "Cancel",
              }),
            ]
          : []),
        setting("hostedPaymentButtonOptions", { text: `Pay $${params.amount.toFixed(2)}` }),
        setting("hostedPaymentOrderOptions", { show: true, merchantName: "LumeraMD" }),
        setting("hostedPaymentPaymentOptions", { cardCodeRequired: true, showCreditCard: true, showBankAccount: false }),
        setting("hostedPaymentBillingAddressOptions", { show: true, required: true }),
        setting("hostedPaymentCustomerOptions", { showEmail: false, requiredEmail: false }),
      ],
    },
  });
  const token = data.token;
  if (typeof token !== "string") throw new AuthnetError("Authorize.net did not return a payment token.");
  return token;
}

export interface TransactionDetails {
  transId: string;
  status: string; // e.g. settledSuccessfully, capturedPendingSettlement, declined
  amount: number;
  /** Our "lumera:<customerId>" tag, from the order description. */
  tag: string | null;
  subscriptionId: string | null;
  email: string | null;
}

export async function getTransactionDetails(transId: string): Promise<TransactionDetails> {
  const data = await call("getTransactionDetailsRequest", { transId });
  const t = (data.transaction ?? {}) as Json;
  const order = (t.order ?? {}) as Json;
  const subscription = (t.subscription ?? {}) as Json;
  const customer = (t.customer ?? {}) as Json;
  return {
    transId: String(t.transId ?? transId),
    status: String(t.transactionStatus ?? ""),
    amount: Number(t.settleAmount ?? t.authAmount ?? 0),
    tag: typeof order.description === "string" ? order.description : null,
    subscriptionId: subscription.id !== undefined ? String(subscription.id) : null,
    email: typeof customer.email === "string" ? customer.email : null,
  };
}

/** Saves the card used in a charge as a customer profile so it can be billed again by subscription. */
export async function createProfileFromTransaction(transId: string, customerId: string) {
  const data = await call("createCustomerProfileFromTransactionRequest", {
    transId,
    customer: { merchantCustomerId: customerId.slice(0, 20) },
  });
  const profileId = String(data.customerProfileId ?? "");
  const paymentIds = (data.customerPaymentProfileIdList ?? []) as unknown[];
  const paymentProfileId = paymentIds.length ? String(paymentIds[0]) : "";
  if (!profileId || !paymentProfileId) throw new AuthnetError("Authorize.net did not return a customer profile.");
  return { customerProfileId: profileId, paymentProfileId };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Bills the saved card every month, starting on `startDate` (the first month was just paid).
 * Authorize.net needs a few seconds after saving a card before a subscription can use it, and
 * answers "record cannot be found" (E00040) until then, so that one error is retried.
 */
export async function createMonthlySubscription(
  params: {
    customerId: string;
    name: string;
    amount: number;
    startDate: Date;
    customerProfileId: string;
    paymentProfileId: string;
  },
  retryDelayMs = 3000,
): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await createSubscriptionOnce(params);
    } catch (err) {
      if (!(err instanceof AuthnetError) || err.code !== "E00040" || attempt >= 5) throw err;
      await sleep(retryDelayMs);
    }
  }
}

async function createSubscriptionOnce(params: {
  customerId: string;
  name: string;
  amount: number;
  startDate: Date;
  customerProfileId: string;
  paymentProfileId: string;
}): Promise<string> {
  const data = await call("ARBCreateSubscriptionRequest", {
    subscription: {
      name: params.name.slice(0, 50),
      paymentSchedule: {
        interval: { length: 1, unit: "months" },
        startDate: isoDate(params.startDate),
        totalOccurrences: 9999, // open-ended; we cancel it when the membership is cancelled
      },
      amount: params.amount.toFixed(2),
      order: { description: customerTag(params.customerId).slice(0, 255) },
      profile: {
        customerProfileId: params.customerProfileId,
        customerPaymentProfileId: params.paymentProfileId,
      },
    },
  });
  const id = data.subscriptionId;
  if (id === undefined) throw new AuthnetError("Authorize.net did not return a subscription id.");
  return String(id);
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await call("ARBCancelSubscriptionRequest", { subscriptionId });
}

/**
 * Checks the X-ANET-Signature header ("sha512=<HEX>") against the raw request body. The signature
 * key is a hex string; Authorize.net's docs show it used both as plain text and hex-decoded, so
 * either match is accepted. Neither can be produced without the key.
 */
export function verifyAuthnetWebhook(rawBody: string, signatureHeader: string | null): boolean {
  const key = process.env.AUTHNET_SIGNATURE_KEY;
  if (!key || !signatureHeader) return false;
  const given = signatureHeader.replace(/^sha512=/i, "").trim().toLowerCase();

  const candidates = [key, /^[0-9a-fA-F]+$/.test(key) && key.length % 2 === 0 ? Buffer.from(key, "hex") : null];
  for (const secret of candidates) {
    if (!secret) continue;
    const digest = crypto.createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(digest);
    const b = Buffer.from(given);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}
