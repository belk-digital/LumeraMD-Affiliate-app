// End-to-end check of the membership lifecycle against a real database. Never touches Shopify
// (skipShopify) and logs emails instead of sending them. Refuses to run against production, and
// deletes everything it creates.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/testMembership.ts
import "dotenv/config"; // does not override an already-exported DATABASE_URL
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  addOneMonth,
  adjustConsultationsUsed,
  cancelMembership,
  MembershipError,
  processMembershipLifecycle,
  recordMembershipPayment,
} from "../src/lib/membership/lifecycle";

const TAG = `e2e${Date.now()}`;
const ok = (label: string) => console.log("  ✓", label);
const SKIP = { skipShopify: true };
const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  const settingsBefore = await prisma.affiliateSettings.upsert({ where: { id: "global" }, update: {}, create: { id: "global" } });
  const rep = await prisma.affiliate.create({
    data: { userEmail: `${TAG}-rep@example.test`, displayName: "Rep", status: "approved", referralSlug: `${TAG}-rep` },
  });
  const premium = await prisma.customerSignup.create({
    data: { firstName: "Pat", lastName: "Premium", email: `${TAG}-premium@example.test`, plan: "customer_premium", referredByAffiliateId: rep.id },
  });
  const basic = await prisma.customerSignup.create({
    data: { firstName: "Bo", lastName: "Basic", email: `${TAG}-basic@example.test`, plan: "customer_basic" },
  });

  try {
    console.log("\nMonth arithmetic");
    assert.equal(addOneMonth(new Date("2026-01-31T10:00:00Z")).toISOString(), "2026-02-28T10:00:00.000Z");
    assert.equal(addOneMonth(new Date("2028-01-31T10:00:00Z")).toISOString(), "2028-02-29T10:00:00.000Z");
    assert.equal(addOneMonth(new Date("2026-12-15T10:00:00Z")).toISOString(), "2027-01-15T10:00:00.000Z");
    ok("Jan 31 -> Feb 28/29, Dec -> Jan rolls the year");

    console.log("\nFirst payment activates the membership");
    assert.equal(premium.status, "pending_payment");
    const first = await recordMembershipPayment({ customerId: premium.id, amount: 179, source: "manual", externalId: "pay-1" }, SKIP);
    assert.equal(first.duplicate, false);
    assert.equal(first.firstActivation, true);
    assert.equal(first.customer.status, "active");
    assert.ok(first.customer.activatedAt);
    assert.ok(first.customer.currentPeriodEnd && first.customer.currentPeriodEnd > new Date(Date.now() + 27 * DAY));
    ok("pending_payment -> active, period runs about a month");
    assert.match(first.customer.memberDiscountCode ?? "", /^MEMBER-[A-Z2-9]{6}$/);
    assert.equal(first.customer.memberDiscountActive, true);
    ok(`member discount code issued (${first.customer.memberDiscountCode})`);
    assert.equal(await prisma.affiliateConversion.count({ where: { shopifyOrderId: `membership:${first.payment.id}` } }), 0);
    ok("rep earns nothing while membership commission is off (default)");

    console.log("\nA repeated payment id is ignored");
    const dup = await recordMembershipPayment({ customerId: premium.id, amount: 179, source: "manual", externalId: "pay-1" }, SKIP);
    assert.equal(dup.duplicate, true);
    assert.equal(await prisma.membershipPayment.count({ where: { customerId: premium.id } }), 1);
    ok("no second payment row, period unchanged");

    console.log("\nRenewing early stacks onto the current period");
    const second = await recordMembershipPayment({ customerId: premium.id, amount: 179, source: "manual", externalId: "pay-2" }, SKIP);
    assert.equal(second.firstActivation, false);
    assert.equal(second.payment.periodStart.getTime(), first.customer.currentPeriodEnd!.getTime());
    assert.equal(second.customer.currentPeriodEnd!.getTime(), addOneMonth(first.customer.currentPeriodEnd!).getTime());
    assert.equal(second.customer.memberDiscountCode, first.customer.memberDiscountCode);
    ok("second month starts where the first ends; same discount code");

    console.log("\nMembership commission toggle");
    await prisma.affiliateSettings.update({ where: { id: "global" }, data: { membershipCommissionEnabled: true } });
    const third = await recordMembershipPayment({ customerId: premium.id, amount: 179, source: "manual", externalId: "pay-3" }, SKIP);
    const conv = await prisma.affiliateConversion.findUnique({ where: { shopifyOrderId: `membership:${third.payment.id}` } });
    assert.ok(conv, "conversion created for the referring rep");
    assert.equal(conv.affiliateId, rep.id);
    assert.equal(conv.orderSubtotal, 179);
    assert.ok(conv.commissionAmount > 0);
    ok(`rep credited $${conv.commissionAmount.toFixed(2)} on the $179 payment`);
    const noRep = await recordMembershipPayment({ customerId: basic.id, amount: 49, source: "manual" }, SKIP);
    assert.equal(await prisma.affiliateConversion.count({ where: { orderSubtotal: 49, shopifyOrderName: "Basic membership" } }), 0);
    assert.equal(noRep.customer.status, "active");
    ok("a customer with no referrer creates no commission");
    await prisma.affiliateSettings.update({ where: { id: "global" }, data: { membershipCommissionEnabled: settingsBefore.membershipCommissionEnabled } });

    console.log("\nLapse handling");
    await prisma.customerSignup.update({ where: { id: premium.id }, data: { currentPeriodEnd: new Date(Date.now() - 1 * DAY) } });
    let run = await processMembershipLifecycle(SKIP);
    assert.equal((await prisma.customerSignup.findUniqueOrThrow({ where: { id: premium.id } })).status, "active");
    ok("1 day late is inside the grace window, still active");
    await prisma.customerSignup.update({ where: { id: premium.id }, data: { currentPeriodEnd: new Date(Date.now() - 10 * DAY) } });
    run = await processMembershipLifecycle(SKIP);
    assert.ok(run.markedPastDue >= 1);
    const lapsed = await prisma.customerSignup.findUniqueOrThrow({ where: { id: premium.id } });
    assert.equal(lapsed.status, "past_due");
    assert.equal(lapsed.memberDiscountActive, false);
    assert.equal(lapsed.memberDiscountCode, first.customer.memberDiscountCode);
    ok("10 days late -> past_due and the discount is switched off (code remembered)");
    run = await processMembershipLifecycle(SKIP);
    assert.equal((await prisma.customerSignup.findUniqueOrThrow({ where: { id: premium.id } })).status, "past_due");
    ok("running the job again changes nothing");

    console.log("\nPaying again brings a lapsed member back");
    const back = await recordMembershipPayment({ customerId: premium.id, amount: 179, source: "manual", externalId: "pay-4" }, SKIP);
    assert.equal(back.customer.status, "active");
    assert.equal(back.customer.memberDiscountActive, true);
    assert.equal(back.customer.memberDiscountCode, first.customer.memberDiscountCode);
    assert.ok(back.customer.currentPeriodEnd! > new Date(Date.now() + 27 * DAY));
    ok("active again with the same discount code, new period starts today");

    console.log("\nConsultations (Premium includes 2)");
    assert.equal((await adjustConsultationsUsed(premium.id, 1)).consultationsUsed, 1);
    assert.equal((await adjustConsultationsUsed(premium.id, 1)).consultationsUsed, 2);
    await assert.rejects(adjustConsultationsUsed(premium.id, 1), (e: unknown) => e instanceof MembershipError && e.status === 400);
    assert.equal((await adjustConsultationsUsed(premium.id, -1)).consultationsUsed, 1);
    await assert.rejects(adjustConsultationsUsed(basic.id, 1), (e: unknown) => e instanceof MembershipError && e.status === 400);
    ok("can't go above the plan's allowance or below zero; Basic has none");

    console.log("\nCancellation");
    const cancelled = await cancelMembership(premium.id, SKIP);
    assert.equal(cancelled.customer.status, "cancelled");
    assert.ok(cancelled.customer.cancelledAt);
    assert.equal(cancelled.customer.memberDiscountActive, false);
    ok("cancelled, discount removed");
    await assert.rejects(cancelMembership(premium.id, SKIP), (e: unknown) => e instanceof MembershipError && e.status === 409);
    ok("cancelling twice is refused");
    const pend = await prisma.customerSignup.create({ data: { firstName: "N", lastName: "P", email: `${TAG}-never@example.test`, plan: "customer_plus" } });
    assert.equal((await cancelMembership(pend.id, SKIP)).customer.status, "cancelled");
    ok("a never-paid signup can be cancelled too");

    console.log("\nBad input");
    await assert.rejects(recordMembershipPayment({ customerId: basic.id, amount: 0, source: "manual" }, SKIP), (e: unknown) => e instanceof MembershipError && e.status === 400);
    await assert.rejects(recordMembershipPayment({ customerId: "nope", amount: 10, source: "manual" }, SKIP), (e: unknown) => e instanceof MembershipError && e.status === 404);
    ok("zero amount -> 400, unknown member -> 404");

    console.log("\nALL CHECKS PASSED");
  } finally {
    const customers = await prisma.customerSignup.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
    const affiliates = await prisma.affiliate.findMany({ where: { userEmail: { startsWith: TAG } }, select: { id: true } });
    const aIds = affiliates.map((a) => a.id);
    await prisma.conversionOverride.deleteMany({ where: { affiliateId: { in: aIds } } });
    await prisma.affiliateConversion.deleteMany({ where: { affiliateId: { in: aIds } } });
    await prisma.notification.deleteMany({ where: { affiliateId: { in: aIds } } });
    await prisma.affiliate.deleteMany({ where: { id: { in: aIds } } });
    await prisma.customerSignup.deleteMany({ where: { id: { in: customers.map((c) => c.id) } } });
    await prisma.affiliateSettings.update({ where: { id: "global" }, data: { membershipCommissionEnabled: settingsBefore.membershipCommissionEnabled } });
    console.log(`\ncleaned up ${customers.length} members and ${aIds.length} affiliates; membershipCommissionEnabled restored to ${settingsBefore.membershipCommissionEnabled}`);
  }
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
