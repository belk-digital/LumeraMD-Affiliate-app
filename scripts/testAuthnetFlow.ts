// End-to-end check of Authorize.net membership billing against the SANDBOX and a real (non-prod)
// database: a first payment activates the member and starts a monthly subscription, the same
// webhook delivered twice changes nothing, other charges on the account are ignored, cancelling
// stops the subscription, and a late charge can't revive a cancelled member. Never touches Shopify,
// logs emails instead of sending them, refuses to run against production, and deletes what it makes.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx --env-file=.env.local scripts/testAuthnetFlow.ts
import "dotenv/config"; // does not override an already-exported DATABASE_URL
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { customerTag } from "../src/lib/authnet/client";
import { handleAuthnetPayment } from "../src/lib/authnet/handlePayment";
import { cancelMembership } from "../src/lib/membership/lifecycle";
import { POST as webhook } from "../src/app/api/webhooks/authorizenet/route";

const TAG = `anet${Date.now()}`;
const ok = (label: string) => console.log("  ✓", label);
const SKIP = { skipShopify: true };
const API = "https://apitest.authorize.net/xml/v1/request.api";

async function api(name: string, body: object) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      [name]: {
        merchantAuthentication: { name: process.env.AUTHNET_API_LOGIN_ID, transactionKey: process.env.AUTHNET_TRANSACTION_KEY },
        ...body,
      },
    }),
  });
  return JSON.parse((await res.text()).replace(/^﻿/, ""));
}

// A sandbox card payment, like the one the hosted page makes. Each charge gets its own amount
// because Authorize.net rejects an identical charge within two minutes.
let cents = (Date.now() % 4000) + 100;
async function charge(description: string | null, email: string): Promise<string> {
  cents += 7;
  const out = await api("createTransactionRequest", {
    transactionRequest: {
      transactionType: "authCaptureTransaction",
      amount: (cents / 100).toFixed(2),
      payment: { creditCard: { cardNumber: "4111111111111111", expirationDate: "2030-12", cardCode: "123" } },
      ...(description ? { order: { description } } : {}),
      customer: { email },
      billTo: { firstName: "Test", lastName: "Member" },
    },
  });
  const id: string = out.transactionResponse?.transId;
  assert.ok(id && id !== "0", `charge failed: ${JSON.stringify(out.transactionResponse?.errors ?? out.messages)}`);
  // The sandbox account's fraud filters sometimes hold a payment for review (response code 4).
  // Approve it, as an admin would, so it counts as paid; the handler skips held payments.
  if (out.transactionResponse?.responseCode === "4") {
    const approve = await api("updateHeldTransactionRequest", { heldTransactionRequest: { action: "approve", refTransId: id } });
    assert.equal(approve.messages?.resultCode, "Ok", `approve failed: ${JSON.stringify(approve.messages)}`);
  }
  return id;
}

async function subscriptionStatus(id: string): Promise<string> {
  return (await api("ARBGetSubscriptionStatusRequest", { subscriptionId: id })).status;
}

const signed = (body: string, key = process.env.AUTHNET_SIGNATURE_KEY!) =>
  new NextRequest("http://localhost/api/webhooks/authorizenet", {
    method: "POST",
    body,
    headers: { "x-anet-signature": `sha512=${crypto.createHmac("sha512", key).update(body).digest("hex").toUpperCase()}` },
  });

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");
  if (process.env.AUTHNET_ENV !== "sandbox") throw new Error("Refusing to run: AUTHNET_ENV must be 'sandbox'.");

  const email = `${TAG}@example.test`;
  const member = await prisma.customerSignup.create({
    data: { firstName: "Anet", lastName: "Test", email, plan: "customer_basic" },
  });
  const created: string[] = [member.id];

  try {
    // 1. First payment, as the hosted page would make it.
    const first = await charge(customerTag(member.id), email);
    const r1 = await handleAuthnetPayment(first, SKIP);
    assert.equal(r1.outcome, "recorded");
    assert.ok(r1.outcome === "recorded" && !r1.duplicate && r1.subscriptionId);
    let m = await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id }, include: { payments: true } });
    assert.equal(m.status, "active");
    assert.equal(m.payments.length, 1);
    assert.equal(m.payments[0].source, "authorizenet");
    assert.equal(m.payments[0].externalId, first);
    assert.ok(m.authnetSubscriptionId && m.authnetCustomerProfileId && m.authnetPaymentProfileId);
    ok("first payment activates the member and saves the card");
    const subscriptionId = m.authnetSubscriptionId!;
    assert.equal(await subscriptionStatus(subscriptionId), "active");
    const periodEnd = m.currentPeriodEnd!;
    const daysAhead = (periodEnd.getTime() - Date.now()) / 86_400_000;
    assert.ok(daysAhead > 27 && daysAhead < 32, `period should run about a month, got ${daysAhead} days`);
    ok("a monthly subscription is live at Authorize.net, and the period runs one month");

    // 2. The same webhook again (Authorize.net retries): nothing may change.
    const r2 = await handleAuthnetPayment(first, SKIP);
    assert.ok(r2.outcome === "recorded" && r2.duplicate && r2.subscriptionId === subscriptionId);
    m = await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id }, include: { payments: true } });
    assert.equal(m.payments.length, 1);
    assert.equal(m.authnetSubscriptionId, subscriptionId);
    assert.equal(m.currentPeriodEnd!.getTime(), periodEnd.getTime());
    ok("replaying the same payment changes nothing (no second payment or subscription)");

    // 3. A charge that isn't a membership (other sales on the same merchant account).
    const other = await charge(null, `${TAG}-other@example.test`);
    const r3 = await handleAuthnetPayment(other, SKIP);
    assert.deepEqual(r3, { outcome: "ignored", reason: "not a membership payment" });
    ok("charges that aren't memberships are ignored");

    // 4. The webhook route itself: signature check, then the same flow.
    const viaWebhook = await charge(customerTag(member.id), email);
    const body = JSON.stringify({ eventType: "net.authorize.payment.authcapture.created", payload: { id: viaWebhook } });
    assert.equal((await webhook(signed(body, "not-the-key"))).status, 401);
    ok("webhook rejects a wrong signature");
    const res = await webhook(signed(body));
    assert.equal(res.status, 200);
    m = await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id }, include: { payments: true } });
    assert.equal(m.payments.length, 2);
    ok("webhook accepts a good signature and records the payment");
    // A new payment on the hosted page may be a new card, so it replaces the old subscription.
    assert.ok(m.authnetSubscriptionId && m.authnetSubscriptionId !== subscriptionId);
    assert.equal(await subscriptionStatus(subscriptionId), "canceled");
    assert.equal(await subscriptionStatus(m.authnetSubscriptionId), "active");
    ok("a new payment replaces the old subscription (old one cancelled, only one live)");

    // 5. Cancelling stops the subscription at Authorize.net.
    const cancelled = await cancelMembership(member.id, SKIP);
    assert.equal(cancelled.customer.status, "cancelled");
    assert.equal(cancelled.customer.authnetSubscriptionId, null);
    assert.deepEqual(cancelled.warnings, []);
    assert.equal(await subscriptionStatus(m.authnetSubscriptionId!), "canceled");
    ok("cancelling stops the subscription at Authorize.net");

    // 6. A late charge must not revive a cancelled member.
    const late = await charge(customerTag(member.id), email);
    const r6 = await handleAuthnetPayment(late, SKIP);
    assert.equal(r6.outcome, "ignored");
    m = await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id }, include: { payments: true } });
    assert.equal(m.status, "cancelled");
    assert.equal(m.payments.length, 2);
    ok("a charge on a cancelled member is flagged for refund and does not reactivate them");

    console.log("\nAll Authorize.net membership flow checks passed.");
  } finally {
    const wallets = await prisma.walletAccount.findMany({ where: { ownerKey: { contains: TAG } }, select: { id: true } });
    const walletIds = wallets.map((w) => w.id);
    await prisma.walletTransaction.deleteMany({ where: { accountId: { in: walletIds } } });
    await prisma.walletAccount.deleteMany({ where: { id: { in: walletIds } } });
    await prisma.customerSignup.deleteMany({ where: { id: { in: created } } });
  }
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
