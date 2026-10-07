// Complimentary (no-payment) memberships against a real database. Skips Shopify, logs emails,
// refuses production, and deletes everything it creates.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/testComplimentary.ts
import "dotenv/config";
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  MembershipError,
  cancelMembership,
  grantComplimentary,
  processMembershipLifecycle,
  recordMembershipPayment,
} from "../src/lib/membership/lifecycle";

const TAG = `cp${Date.now()}`;
const email = `${TAG}@example.test`;
const ok = (l: string) => console.log("  ✓", l);
const SKIP = { skipShopify: true };

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  const before = await prisma.affiliateSettings.findUnique({ where: { id: "global" } });
  await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: { membershipCommissionEnabled: true },
    create: { id: "global", membershipCommissionEnabled: true },
  });
  const referrer = await prisma.affiliate.create({
    data: { userEmail: `${TAG}-ref@example.test`, displayName: "Ref", status: "approved", referralSlug: `${TAG}-ref` },
  });
  const m = await prisma.customerSignup.create({
    data: { firstName: "Free", lastName: "Friend", email, plan: "customer_premium", referredByAffiliateId: referrer.id },
  });

  try {
    console.log("\nGranting access without payment");
    await assert.rejects(grantComplimentary(m.id, { note: "  " }, SKIP), (e) => e instanceof MembershipError && e.status === 400);
    ok("a note is required");

    const res = await grantComplimentary(m.id, { note: "Friend of the founder", adminEmail: "admin@x.test" }, SKIP);
    const c = res.customer;
    assert.equal(c.status, "active");
    assert.equal(c.complimentary, true);
    assert.equal(c.currentPeriodEnd, null);
    assert.equal(c.complimentaryBy, "admin@x.test");
    assert.equal(c.memberDiscountActive, true);
    assert.ok(c.activatedAt);
    ok("active, no end date, note and admin recorded, member discount on");

    assert.equal(await prisma.membershipPayment.count({ where: { customerId: m.id } }), 0);
    assert.equal(await prisma.affiliateConversion.count({ where: { affiliateId: referrer.id } }), 0);
    ok("no payment row and no referrer commission, even with membership commission ON");

    await assert.rejects(grantComplimentary(m.id, { note: "again" }, SKIP), (e) => e instanceof MembershipError && e.status === 409);
    ok("granting twice is refused");

    console.log("\nThe daily lapse check never expires it");
    const future = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);
    await processMembershipLifecycle(SKIP, future);
    assert.equal((await prisma.customerSignup.findUniqueOrThrow({ where: { id: m.id } })).status, "active");
    ok("still active 400 days later");

    console.log("\nA real payment turns it into a normal paying membership");
    const paid = await recordMembershipPayment({ customerId: m.id, amount: 179, source: "manual" }, SKIP);
    assert.equal(paid.customer.complimentary, false);
    assert.ok(paid.customer.currentPeriodEnd);
    ok("complimentary cleared, normal paid period set");

    console.log("\nCancelling clears it too");
    await grantComplimentary((await prisma.customerSignup.create({ data: { firstName: "B", lastName: "B", email: `${TAG}-b@example.test`, plan: "customer_basic" } })).id, { note: "second" }, SKIP);
    const b = await prisma.customerSignup.findFirstOrThrow({ where: { email: `${TAG}-b@example.test` } });
    const cancelled = await cancelMembership(b.id, SKIP);
    assert.equal(cancelled.customer.complimentary, false);
    assert.equal(cancelled.customer.status, "cancelled");
    ok("cancelled and no longer complimentary");
  } finally {
    await prisma.affiliateSettings.update({
      where: { id: "global" },
      data: { membershipCommissionEnabled: before?.membershipCommissionEnabled ?? false },
    });
    await prisma.affiliateConversion.deleteMany({ where: { affiliateId: referrer.id } });
    await prisma.customerSignup.deleteMany({ where: { email: { startsWith: TAG } } });
    await prisma.notification.deleteMany({ where: { affiliateId: referrer.id } });
    await prisma.affiliate.deleteMany({ where: { id: referrer.id } });
    console.log("\ncleaned up");
  }
}
main().catch((e) => { console.error("\nFAILED:", e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
