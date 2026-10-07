// Approving a sales rep also creates their (unpaid) agent membership; the first recorded payment
// activates it, and the $79 fee never earns the referrer commission. Runs against a real database,
// skips Shopify, logs emails, refuses production, and deletes everything it creates.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/testRepMembership.ts
import "dotenv/config";
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { createAffiliateFromSalesRepSignup } from "../src/lib/affiliates/createFromSalesRep";
import { recordMembershipPayment } from "../src/lib/membership/lifecycle";

const TAG = `rm${Date.now()}`;
const email = (n: string) => `${TAG}-${n}@example.test`;
const ok = (label: string) => console.log("  ✓", label);

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
    data: { userEmail: email("referrer"), displayName: "Referrer", status: "approved", referralSlug: `${TAG}-ref` },
  });
  const rep = await prisma.salesRepSignup.create({
    data: { email: email("jane"), firstName: "Jane", lastName: "Doe", phone: "+1 2015550123", referredByAffiliateId: referrer.id },
  });

  try {
    console.log("\nApproving a rep creates an unpaid agent membership");
    await createAffiliateFromSalesRepSignup(rep.id, { skipShopifyDiscount: true });
    const member = await prisma.customerSignup.findFirstOrThrow({ where: { email: email("jane") } });
    assert.equal(member.plan, "agent");
    assert.equal(member.status, "pending_payment");
    assert.equal(member.referredByAffiliateId, null);
    assert.equal(member.firstName, "Jane");
    assert.equal(member.memberDiscountActive, false);
    ok("membership is pending_payment, agent plan, no referrer, no discount yet");

    await createAffiliateFromSalesRepSignup(rep.id, { skipShopifyDiscount: true });
    assert.equal(await prisma.customerSignup.count({ where: { email: email("jane") } }), 1);
    ok("approving twice doesn't create a second membership");

    console.log("\nFirst $79 payment activates it");
    // Even if a referrer were attached, the guard must stop the commission.
    await prisma.customerSignup.update({ where: { id: member.id }, data: { referredByAffiliateId: referrer.id } });
    const res = await recordMembershipPayment(
      { customerId: member.id, amount: 79, source: "manual", note: "test" },
      { skipShopify: true },
    );
    assert.equal(res.customer.status, "active");
    assert.equal(res.customer.memberDiscountActive, true);
    assert.match(res.customer.memberDiscountCode ?? "", /^MEMBER-/);
    ok(`active with discount code ${res.customer.memberDiscountCode}`);

    const conversions = await prisma.affiliateConversion.count({ where: { affiliateId: referrer.id } });
    assert.equal(conversions, 0);
    ok("the $79 fee created no commission, even with a referrer attached and membership commission ON");

    console.log("\nAn existing unpaid customer is moved onto the agent plan");
    const existing = await prisma.customerSignup.create({
      data: { firstName: "Old", lastName: "Cust", email: email("old"), plan: "customer_basic" },
    });
    const rep2 = await prisma.salesRepSignup.create({ data: { email: email("old"), firstName: "Old", lastName: "Cust" } });
    await createAffiliateFromSalesRepSignup(rep2.id, { skipShopifyDiscount: true });
    const moved = await prisma.customerSignup.findUniqueOrThrow({ where: { id: existing.id } });
    assert.equal(moved.plan, "agent");
    assert.equal(await prisma.customerSignup.count({ where: { email: email("old") } }), 1);
    ok("reused the existing membership instead of creating a duplicate");
  } finally {
    await prisma.affiliateSettings.update({
      where: { id: "global" },
      data: { membershipCommissionEnabled: before?.membershipCommissionEnabled ?? false },
    });
    await prisma.affiliateConversion.deleteMany({ where: { affiliate: { userEmail: { startsWith: TAG } } } });
    const aff = await prisma.affiliate.findMany({ where: { userEmail: { startsWith: TAG } } });
    const ids = aff.map((a) => a.id);
    await prisma.notification.deleteMany({ where: { affiliateId: { in: ids } } });
    await prisma.affiliate.updateMany({ where: { id: { in: ids } }, data: { parentAffiliateId: null } });
    await prisma.affiliate.deleteMany({ where: { id: { in: ids } } });
    await prisma.salesRepSignup.deleteMany({ where: { email: { startsWith: TAG, mode: "insensitive" } } });
    const c = await prisma.customerSignup.deleteMany({ where: { email: { startsWith: TAG, mode: "insensitive" } } });
    console.log(`\ncleaned up ${ids.length} affiliates and ${c.count} memberships`);
  }
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
