// Sales rep path for Authorize.net billing on the SANDBOX and a non-prod database: approving a rep
// creates their unpaid Premium ($79) membership, the "Pay & Activate" email carries the pay link,
// the first payment activates it and starts a $79 monthly subscription, and the $79 pays nobody
// commission. Never touches Shopify, logs emails instead of sending them, deletes what it makes.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx --env-file=.env.local scripts/testAuthnetRep.ts
import "dotenv/config";
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { customerTag } from "../src/lib/authnet/client";
import { handleAuthnetPayment } from "../src/lib/authnet/handlePayment";
import { createAffiliateFromSalesRepSignup } from "../src/lib/affiliates/createFromSalesRep";
import { cancelMembership } from "../src/lib/membership/lifecycle";
import { notifyRepPaymentDue } from "../src/lib/email/membership";

const TAG = `anetrep${Date.now()}`;
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

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");
  if (process.env.AUTHNET_ENV !== "sandbox") throw new Error("Refusing to run: AUTHNET_ENV must be 'sandbox'.");

  const email = `${TAG}@example.test`;
  const upline = await prisma.affiliate.create({
    data: { userEmail: `${TAG}-upline@example.test`, displayName: "Upline", status: "approved", referralSlug: `${TAG}-up` },
  });
  const signup = await prisma.salesRepSignup.create({
    data: { firstName: "Rep", lastName: "Tester", email, plan: "agent", referredByAffiliateId: upline.id },
  });
  let affiliateId: string | undefined;

  try {
    const affiliate = await createAffiliateFromSalesRepSignup(signup.id, { skipShopifyDiscount: true });
    affiliateId = affiliate.id;
    const member = await prisma.customerSignup.findFirstOrThrow({ where: { email, plan: "agent" } });
    assert.equal(member.status, "pending_payment");
    ok("approving the rep creates their unpaid Premium membership");

    // The email the approve route sends: it must carry this member's pay link.
    const logged: string[] = [];
    const realLog = console.log;
    console.log = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
    try {
      await notifyRepPaymentDue(member);
    } finally {
      console.log = realLog;
    }
    const email1 = logged.join("\n");
    assert.ok(email1.includes(`/pay/${member.id}`), "pay email should link to the member's pay page");
    assert.ok(email1.includes("Activate your LumeraMD Premium membership"));
    ok("the approval email links to the rep's pay page");

    // First payment, as the hosted page makes it. Authorize.net rejects an identical charge twice
    // within two minutes, so the cents vary per run; the plan price ($79) is what renews.
    const chargeAmount = 79 + (Date.now() % 50) / 100;
    const out = await api("createTransactionRequest", {
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: chargeAmount.toFixed(2),
        payment: { creditCard: { cardNumber: "5424000000000015", expirationDate: "2030-12", cardCode: "123" } },
        order: { description: customerTag(member.id) },
        customer: { email },
        billTo: { firstName: "Rep", lastName: "Tester" },
      },
    });
    const transId: string = out.transactionResponse?.transId;
    assert.ok(transId && transId !== "0", `charge failed: ${JSON.stringify(out.transactionResponse?.errors ?? out.messages)}`);

    let result = await handleAuthnetPayment(transId, { skipShopify: true });
    // The sandbox account's fraud filters may hold the payment for review. A held payment must not
    // activate anyone; once approved (the "fraud approved" webhook) it must.
    if (result.outcome === "ignored" && /FDSPendingReview/.test(result.reason)) {
      assert.equal((await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id } })).status, "pending_payment");
      ok("a payment held by the fraud filters does not activate the rep");
      const approve = await api("updateHeldTransactionRequest", { heldTransactionRequest: { action: "approve", refTransId: transId } });
      assert.equal(approve.messages?.resultCode, "Ok", `approve failed: ${JSON.stringify(approve.messages)}`);
      result = await handleAuthnetPayment(transId, { skipShopify: true });
    }
    assert.equal(result.outcome, "recorded", `handler said: ${JSON.stringify(result)}`);
    const paid = await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id }, include: { payments: true } });
    assert.equal(paid.status, "active");
    assert.equal(Math.floor(paid.payments[0].amount), 79);
    assert.ok(paid.authnetSubscriptionId);
    ok("the rep's first payment activates their Premium membership");

    const sub = await api("ARBGetSubscriptionRequest", { subscriptionId: paid.authnetSubscriptionId });
    assert.equal(Number(sub.subscription.amount), 79, `subscription: ${JSON.stringify(sub.subscription ?? sub.messages)}`);
    assert.equal(sub.subscription.status, "active");
    ok("a $79 monthly subscription is live");

    const commissions = await prisma.affiliateConversion.count({ where: { affiliateId: upline.id } });
    assert.equal(commissions, 0);
    ok("the rep's own $79 pays their upline nothing");

    await cancelMembership(member.id, { skipShopify: true });
  } finally {
    const wallets = await prisma.walletAccount.findMany({ where: { ownerKey: { contains: TAG } }, select: { id: true } });
    const walletIds = wallets.map((w) => w.id);
    await prisma.walletTransaction.deleteMany({ where: { accountId: { in: walletIds } } });
    await prisma.walletAccount.deleteMany({ where: { id: { in: walletIds } } });
    await prisma.customerSignup.deleteMany({ where: { email } });
    await prisma.salesRepSignup.deleteMany({ where: { id: signup.id } });
    const ids = [upline.id, ...(affiliateId ? [affiliateId] : [])];
    await prisma.notification.deleteMany({ where: { affiliateId: { in: ids } } });
    await prisma.affiliate.deleteMany({ where: { id: { in: affiliateId ? [affiliateId] : [] } } });
    await prisma.affiliate.deleteMany({ where: { id: upline.id } });
  }
  console.log("\nAll Authorize.net sales rep checks passed.");
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
