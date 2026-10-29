// Suspending a rep pauses their $79 Authorize.net subscription (it is cancelled, the saved card is
// kept) and reactivating them starts a new one from that card. SANDBOX and a non-prod database only;
// logs emails instead of sending them and deletes what it makes.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx --env-file=.env.local scripts/testRepPause.ts
import "dotenv/config";
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { customerTag } from "../src/lib/authnet/client";
import { handleAuthnetPayment } from "../src/lib/authnet/handlePayment";
import { createAffiliateFromSalesRepSignup } from "../src/lib/affiliates/createFromSalesRep";
import { cancelMembership, processMembershipLifecycle } from "../src/lib/membership/lifecycle";
import { pauseRepBilling, resumeRepBilling } from "../src/lib/authnet/repBilling";

const TAG = `anetpause${Date.now()}`;
const ok = (label: string) => console.log("  ✓", label);
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

const subscriptionStatus = async (id: string) => (await api("ARBGetSubscriptionRequest", { subscriptionId: id })).subscription?.status;

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");
  if (process.env.AUTHNET_ENV !== "sandbox") throw new Error("Refusing to run: AUTHNET_ENV must be 'sandbox'.");

  const email = `${TAG}@example.test`;
  const signup = await prisma.salesRepSignup.create({
    data: { firstName: "Rep", lastName: "Pauser", email, plan: "agent" },
  });
  let affiliateId: string | undefined;

  try {
    const affiliate = await createAffiliateFromSalesRepSignup(signup.id, { skipShopifyDiscount: true });
    affiliateId = affiliate.id;
    const member = await prisma.customerSignup.findFirstOrThrow({ where: { email, plan: "agent" } });

    const out = await api("createTransactionRequest", {
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: (79 + (Date.now() % 50) / 100).toFixed(2),
        payment: { creditCard: { cardNumber: "5424000000000015", expirationDate: "2030-12", cardCode: "123" } },
        order: { description: customerTag(member.id) },
        customer: { email },
        billTo: { firstName: "Rep", lastName: "Pauser" },
      },
    });
    const transId: string = out.transactionResponse?.transId;
    assert.ok(transId && transId !== "0", `charge failed: ${JSON.stringify(out.transactionResponse?.errors ?? out.messages)}`);
    let result = await handleAuthnetPayment(transId, { skipShopify: true });
    if (result.outcome === "ignored" && /FDSPendingReview/.test(result.reason)) {
      await api("updateHeldTransactionRequest", { heldTransactionRequest: { action: "approve", refTransId: transId } });
      result = await handleAuthnetPayment(transId, { skipShopify: true });
    }
    assert.equal(result.outcome, "recorded", `handler said: ${JSON.stringify(result)}`);
    const paid = await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id } });
    const firstSub = paid.authnetSubscriptionId!;
    assert.ok(firstSub);
    assert.equal(await subscriptionStatus(firstSub), "active");
    ok("the paid rep has an active monthly subscription");

    // Suspending pauses billing.
    assert.deepEqual(await pauseRepBilling({ userEmail: email }), []);
    const paused = await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id } });
    assert.equal(paused.authnetSubscriptionId, null);
    assert.equal(paused.authnetPaymentProfileId, paid.authnetPaymentProfileId);
    assert.equal(paused.status, "active");
    assert.equal(await subscriptionStatus(firstSub), "canceled");
    ok("suspending cancels the subscription, keeps the saved card and leaves the membership alone");

    assert.deepEqual(await pauseRepBilling({ userEmail: email }), []);
    ok("pausing twice is harmless");

    // Reactivating starts a new subscription from the saved card on the day the paid period ends.
    assert.deepEqual(await resumeRepBilling({ userEmail: email }), []);
    const resumed = await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id } });
    assert.ok(resumed.authnetSubscriptionId && resumed.authnetSubscriptionId !== firstSub);
    const sub = (await api("ARBGetSubscriptionRequest", { subscriptionId: resumed.authnetSubscriptionId })).subscription;
    assert.equal(sub.status, "active");
    assert.equal(Number(sub.amount), 79);
    assert.equal(String(sub.paymentSchedule.startDate).slice(0, 10), resumed.currentPeriodEnd!.toISOString().slice(0, 10));
    ok("reactivating starts a new $79 subscription on the day the paid period ends");

    assert.deepEqual(await resumeRepBilling({ userEmail: email }), []);
    assert.equal((await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id } })).authnetSubscriptionId, resumed.authnetSubscriptionId);
    ok("resuming twice does not start a second subscription");

    // A period that ran out during the suspension is not charged silently.
    await pauseRepBilling({ userEmail: email });
    await prisma.customerSignup.update({ where: { id: member.id }, data: { status: "past_due", currentPeriodEnd: new Date(Date.now() - 86400000) } });
    const warnings = await resumeRepBilling({ userEmail: email });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /ran out while they were suspended/);
    assert.equal((await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id } })).authnetSubscriptionId, null);
    ok("a lapsed rep is not charged on reactivation; the admin gets a warning");

    // The daily job marks a lapsed suspended rep past due but doesn't email them a pay reminder.
    async function dailyJobEmails() {
      const logged: string[] = [];
      const realLog = console.log;
      console.log = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
      try {
        await processMembershipLifecycle({ skipShopify: true });
      } finally {
        console.log = realLog;
      }
      return logged.join("\n");
    }
    const lapse = { status: "active" as const, currentPeriodEnd: new Date(Date.now() - 10 * 86400000) };
    await prisma.affiliate.update({ where: { id: affiliateId! }, data: { status: "suspended" } });
    await prisma.customerSignup.update({ where: { id: member.id }, data: lapse });
    const quiet = await dailyJobEmails();
    assert.equal((await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id } })).status, "past_due");
    assert.ok(!quiet.includes(email), "a suspended rep should not be emailed a pay reminder");
    ok("a lapsed suspended rep is marked past due but not emailed");

    await prisma.affiliate.update({ where: { id: affiliateId! }, data: { status: "approved" } });
    await prisma.customerSignup.update({ where: { id: member.id }, data: lapse });
    const loud = await dailyJobEmails();
    assert.ok(loud.includes(email), "an active rep should still be emailed");
    ok("an active rep who lapses is still emailed");

    // A rep who was never billed by card is left alone.
    await prisma.customerSignup.update({
      where: { id: member.id },
      data: { authnetCustomerProfileId: null, authnetPaymentProfileId: null },
    });
    assert.deepEqual(await resumeRepBilling({ userEmail: email }), []);
    assert.deepEqual(await pauseRepBilling({ userEmail: `${TAG}-nobody@example.test` }), []);
    ok("reps with no saved card, and unknown emails, are untouched");

    await cancelMembership(member.id, { skipShopify: true });
  } finally {
    const wallets = await prisma.walletAccount.findMany({ where: { ownerKey: { contains: TAG } }, select: { id: true } });
    const walletIds = wallets.map((w) => w.id);
    await prisma.walletTransaction.deleteMany({ where: { accountId: { in: walletIds } } });
    await prisma.walletAccount.deleteMany({ where: { id: { in: walletIds } } });
    await prisma.customerSignup.deleteMany({ where: { email } });
    await prisma.salesRepSignup.deleteMany({ where: { id: signup.id } });
    if (affiliateId) {
      await prisma.notification.deleteMany({ where: { affiliateId } });
      await prisma.affiliate.deleteMany({ where: { id: affiliateId } });
    }
  }
  console.log("\nAll rep billing pause checks passed.");
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
