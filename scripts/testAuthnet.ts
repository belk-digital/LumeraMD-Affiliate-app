// Walks the Authorize.net client through a full membership payment cycle on the SANDBOX: hosted
// page token, a first charge (made directly with a test card, since the hosted page needs a
// browser), transaction lookup, saving the card, a monthly subscription, and cancelling it. Refuses
// to run unless AUTHNET_ENV is "sandbox". Touches no database.
//
//   pnpm dlx tsx --env-file=.env.local scripts/testAuthnet.ts
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  cancelSubscription,
  createHostedPaymentToken,
  createMonthlySubscription,
  createProfileFromTransaction,
  customerIdFromTag,
  customerTag,
  getTransactionDetails,
  verifyAuthnetWebhook,
} from "../src/lib/authnet/client";

const ok = (label: string) => console.log("  ✓", label);

async function main() {
  if (process.env.AUTHNET_ENV !== "sandbox") throw new Error("Refusing to run: AUTHNET_ENV must be 'sandbox'.");
  const customerId = `test${Date.now()}`;
  const email = `${customerId}@example.test`;
  // A different amount each run, because Authorize.net rejects an identical charge within two minutes.
  const amount = Number((40 + (Date.now() % 5000) / 100).toFixed(2));

  const token = await createHostedPaymentToken({
    customerId,
    email,
    firstName: "Test",
    lastName: "Member",
    amount,
    description: "Basic membership",
    returnUrl: "https://lumeramd.biz/account/membership",
    cancelUrl: "https://lumeramd.biz/customers/signup",
  });
  assert.ok(token.length > 20);
  ok("hosted payment token created");

  // First month, charged straight to the API with a sandbox test card.
  const res = await fetch("https://apitest.authorize.net/xml/v1/request.api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      createTransactionRequest: {
        merchantAuthentication: {
          name: process.env.AUTHNET_API_LOGIN_ID,
          transactionKey: process.env.AUTHNET_TRANSACTION_KEY,
        },
        transactionRequest: {
          transactionType: "authCaptureTransaction",
          amount: amount.toFixed(2),
          payment: { creditCard: { cardNumber: "4111111111111111", expirationDate: "2030-12", cardCode: "123" } },
          order: { description: customerTag(customerId) },
          customer: { email },
          billTo: { firstName: "Test", lastName: "Member" },
        },
      },
    }),
  });
  const charge = JSON.parse((await res.text()).replace(/^﻿/, ""));
  const transId: string = charge.transactionResponse?.transId;
  assert.ok(transId && transId !== "0", `charge failed: ${JSON.stringify(charge.transactionResponse?.errors ?? charge.messages)}`);
  ok(`first charge approved (transaction ${transId})`);

  const details = await getTransactionDetails(transId);
  assert.equal(details.amount, amount);
  assert.equal(customerIdFromTag(details.tag), customerId);
  ok(`lookup returns our member tag (status: ${details.status})`);

  const profile = await createProfileFromTransaction(transId, customerId);
  ok("card saved as a customer profile");

  const startDate = new Date();
  startDate.setUTCMonth(startDate.getUTCMonth() + 1);
  const subscriptionId = await createMonthlySubscription({
    customerId,
    name: "Basic membership",
    amount,
    startDate,
    ...profile,
  });
  ok(`monthly subscription created (${subscriptionId})`);

  await cancelSubscription(subscriptionId);
  ok("subscription cancelled");

  // Webhook signature check, with both ways the key might be applied.
  const body = JSON.stringify({ eventType: "net.authorize.payment.authcapture.created", payload: { id: transId } });
  const key = process.env.AUTHNET_SIGNATURE_KEY!;
  const sign = (secret: string | Buffer) => `sha512=${crypto.createHmac("sha512", secret).update(body).digest("hex").toUpperCase()}`;
  assert.ok(verifyAuthnetWebhook(body, sign(key)));
  assert.ok(verifyAuthnetWebhook(body, sign(Buffer.from(key, "hex"))));
  assert.ok(!verifyAuthnetWebhook(body, sign("wrong-key")));
  assert.ok(!verifyAuthnetWebhook(body, null));
  ok("webhook signature accepted when right, rejected when wrong or missing");

  console.log("\nAll Authorize.net sandbox checks passed.");
}

main().catch((err) => {
  console.error("\nFAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
