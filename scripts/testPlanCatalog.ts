// Customizable membership plans against a real database: the defaults, an admin change showing up everywhere that
// reads the catalog, validation, and the rule that a change only affects new signups (a member keeps the price they
// first paid). Refuses to run against production, skips Shopify, sends no email and restores what it changes.
//
//   RESEND_API_KEY= pnpm dlx tsx --env-file=.env --env-file=.env.local scripts/testPlanCatalog.ts
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { getCatalog } from "../src/lib/membership/plans.server";
import { DEFAULT_PLANS, DEFAULT_TEST_KIT_PRICE, monthlyPriceFor } from "../src/lib/membership/plans";
import { parsePlanInput } from "../src/lib/membership/planInput";
import { recordMembershipPayment } from "../src/lib/membership/lifecycle";

const TAG = `pc${Date.now()}`;
const ok = (label: string) => console.log("  ✓", label);

const good = {
  name: "Plus Max",
  monthlyPrice: "99",
  listPrice: "149",
  webDiscountPercent: "12",
  consultations: "3",
  testKitPrice: "549",
  benefits: "12% off web pricing\n3 consultations\n\nTest kit for $549",
};

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").host;
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");
  delete process.env.RESEND_API_KEY;

  const savedConfigs = await prisma.membershipPlanConfig.findMany();
  const savedSettings = await prisma.membershipSettings.findUnique({ where: { id: "global" } });
  await prisma.membershipPlanConfig.deleteMany();
  await prisma.membershipSettings.deleteMany();

  try {
    console.log("\nDefaults");
    let cat = await getCatalog();
    assert.equal(cat.plans.customer_plus.monthlyPrice, DEFAULT_PLANS.customer_plus.monthlyPrice);
    assert.equal(cat.testKitPrice, DEFAULT_TEST_KIT_PRICE);
    assert.equal(cat.customerPlans.length, 3);
    ok("with nothing customized the catalog is the built-in defaults");

    console.log("\nValidation");
    const bad = (patch: Record<string, unknown>, re: RegExp) => {
      const r = parsePlanInput({ ...good, ...patch });
      assert.equal(r.ok, false);
      assert.match((r as { error: string }).error, re);
    };
    bad({ name: "" }, /name/);
    bad({ monthlyPrice: "0" }, /monthly price/);
    bad({ monthlyPrice: "abc" }, /monthly price/);
    bad({ listPrice: "50" }, /regular/);
    bad({ webDiscountPercent: "101" }, /discount/);
    bad({ webDiscountPercent: "10.5" }, /discount/);
    bad({ consultations: "-1" }, /consultations/);
    bad({ testKitPrice: "-5" }, /test kit/);
    bad({ benefits: "   \n " }, /benefit/);
    ok("bad names, prices, percentages, counts and empty benefits are refused");
    const parsed = parsePlanInput(good);
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.value.benefits, ["12% off web pricing", "3 consultations", "Test kit for $549"]);
    assert.equal(parsed.value.listPrice, 149);
    ok("a good form is accepted; blank benefit lines are dropped");
    const noList = parsePlanInput({ ...good, listPrice: "", testKitPrice: "" });
    assert.ok(noList.ok && noList.value.listPrice === null && noList.value.testKitPrice === null);
    ok("regular price and member test kit price can be left empty");

    console.log("\nA customized plan");
    const input = parsed.value;
    await prisma.membershipPlanConfig.create({ data: { key: "customer_plus", ...input, overrideEligible: false } });
    cat = await getCatalog();
    assert.equal(cat.plans.customer_plus.name, "Plus Max");
    assert.equal(cat.plans.customer_plus.monthlyPrice, 99);
    assert.equal(cat.plans.customer_plus.testKitPrice, 549);
    assert.equal(cat.plans.customer_basic.monthlyPrice, 49);
    assert.equal(cat.customerPlans.find((p) => p.key === "customer_plus")?.monthlyPrice, 99);
    ok("the catalog reflects the change, other plans are untouched");
    await prisma.membershipSettings.create({ data: { id: "global", testKitPrice: 650 } });
    assert.equal((await getCatalog()).testKitPrice, 650);
    ok("the standard test kit price can be changed too");

    console.log("\nNew signups only");
    // A member who paid at the old price keeps it after the plan price changes.
    await prisma.membershipPlanConfig.deleteMany();
    const member = await prisma.customerSignup.create({
      data: { firstName: "Test", lastName: "Old", email: `${TAG}-old@example.test`, plan: "customer_plus" },
    });
    await recordMembershipPayment({ customerId: member.id, amount: 79, source: "admin" }, { skipShopify: true });
    let fresh = await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id } });
    assert.equal(fresh.lockedMonthlyPrice, 79);
    ok("their price is fixed at the first payment");
    await prisma.membershipPlanConfig.create({ data: { key: "customer_plus", ...input, overrideEligible: false } });
    cat = await getCatalog();
    assert.equal(monthlyPriceFor(fresh, cat.plans.customer_plus), 79);
    ok("after the plan goes to $99 that member still pays $79");
    const newcomer = await prisma.customerSignup.create({
      data: { firstName: "Test", lastName: "New", email: `${TAG}-new@example.test`, plan: "customer_plus" },
    });
    assert.equal(monthlyPriceFor(newcomer, cat.plans.customer_plus), 99);
    ok("a new signup on the same plan pays $99");
    await recordMembershipPayment({ customerId: member.id, amount: 79, source: "admin", externalId: `${TAG}-2` }, { skipShopify: true });
    fresh = await prisma.customerSignup.findUniqueOrThrow({ where: { id: member.id } });
    assert.equal(fresh.lockedMonthlyPrice, 79);
    ok("a later renewal does not change their locked price");
    console.log("\nall passed");
  } finally {
    await prisma.customerSignup.deleteMany({ where: { email: { startsWith: TAG } } });
    await prisma.membershipPlanConfig.deleteMany();
    await prisma.membershipSettings.deleteMany();
    for (const c of savedConfigs) await prisma.membershipPlanConfig.create({ data: c });
    if (savedSettings) await prisma.membershipSettings.create({ data: savedSettings });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
