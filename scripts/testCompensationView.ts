// Checks the numbers behind the affiliate dashboard's Compensation page against a real database,
// using the spreadsheet's example team. Refuses to run against production; cleans up after itself.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/testCompensationView.ts
import "dotenv/config"; // does not override an already-exported DATABASE_URL
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { attributeOrder } from "../src/lib/affiliates/commission";
import { getCompensationOverview } from "../src/lib/affiliates/compensation";

const TAG = `e2e${Date.now()}`;
const created: string[] = [];
const ok = (label: string) => console.log("  ✓", label);

async function make(name: string, parentId: string | null) {
  const a = await prisma.affiliate.create({
    data: {
      userEmail: `${TAG}-${name.toLowerCase()}@example.test`,
      displayName: name,
      status: "approved",
      referralSlug: `${TAG}-${name.toLowerCase()}`,
      parentAffiliateId: parentId,
    },
  });
  created.push(a.id);
  return a;
}

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");
  const before = await prisma.affiliateSettings.upsert({ where: { id: "global" }, update: {}, create: { id: "global" } });

  // Michelle (top) <- Jordan <- Greg <- Sarah <- Kevin <- Mason <- Lisa <- Tyler <- Ashley (seller).
  // Qualified = 3 approved direct recruits, so qualified uplines also get two filler recruits.
  const chain = ["Michelle", "Jordan", "Greg", "Sarah", "Kevin", "Mason", "Lisa", "Tyler"];
  const qualified = new Set(["Tyler", "Mason", "Sarah", "Greg", "Michelle"]);
  const by: Record<string, string> = {};
  let parent: string | null = null;
  for (const n of chain) {
    by[n] = (await make(n, parent)).id;
    parent = by[n];
  }
  const ashley = await make("Ashley", by["Tyler"]);
  for (const n of chain) {
    if (qualified.has(n)) {
      await make(`${n}fillerA`, by[n]);
      await make(`${n}fillerB`, by[n]);
    }
  }
  await prisma.affiliateConversion.create({
    data: {
      affiliateId: ashley.id,
      shopifyOrderId: `${TAG}-prior`,
      attributionSource: "referral_link",
      orderSubtotal: 9000,
      eligibleSubtotal: 9000,
      commissionRate: 20,
      commissionAmount: 1800,
      status: "approved",
    },
  });

  try {
    console.log("\nPlan switched off");
    await prisma.affiliateSettings.update({ where: { id: "global" }, data: { unilevelEnabled: false } });
    const off = await getCompensationOverview(by["Tyler"]);
    assert.equal(off.enabled, false);
    assert.equal(off.flatRate, 10);
    ok("reports disabled and the flat 10% rate");

    console.log("\nPlan on — Ashley sells $1,000");
    await prisma.affiliateSettings.update({ where: { id: "global" }, data: { unilevelEnabled: true } });
    const conv = await attributeOrder({
      order: { id: `${TAG}-o1`, name: "#CV1", subtotalPrice: 1000, totalDiscounts: 0, discountCodes: [], customerEmail: "buyer@example.test" },
      cookieAffiliateId: ashley.id,
      cookieClickId: null,
    });
    assert.ok(conv);

    const a = await getCompensationOverview(ashley.id);
    assert.equal(a.enabled, true);
    assert.equal(a.sales, 10000);
    assert.equal(a.tier.name, "Top Seller Tier");
    assert.equal(a.tier.rate, 20);
    assert.equal(a.nextTier, null);
    assert.equal(a.tierProgress, 1);
    assert.equal(a.toNextTier, 0);
    ok("seller: $10,000 this month -> Top Seller Tier at 20%, no next tier");

    const t = await getCompensationOverview(by["Tyler"]);
    assert.equal(t.qualification.activeRecruits, 3);
    assert.equal(t.qualification.qualified, true);
    assert.equal(t.slots[0].earned, 50);
    assert.equal(t.slots[0].sales, 1);
    assert.equal(t.slots[0].rate, 5);
    assert.equal(t.overrideEarnedThisMonth, 50);
    assert.equal(t.overrideEarnedLifetime, 50);
    assert.deepEqual(t.recent.map((r) => [r.level, r.slot, r.amount]), [[1, 1, 50]]);
    ok("Tyler: qualified (3 of 3 recruits), earned $50 in slot 1 at level 1");

    const g = await getCompensationOverview(by["Greg"]);
    assert.deepEqual(g.slots.map((s) => s.earned), [0, 0, 0, 30, 0]);
    assert.deepEqual(g.recent.map((r) => [r.level, r.slot]), [[6, 4]]);
    ok("Greg: level 6 but paid slot 4 ($30), because slots fill with qualified people only");

    const l = await getCompensationOverview(by["Lisa"]);
    assert.equal(l.qualification.activeRecruits, 1);
    assert.equal(l.qualification.requiredRecruits, 3);
    assert.equal(l.qualification.qualified, false);
    assert.equal(l.overrideEarnedThisMonth, 0);
    assert.equal(l.recent.length, 0);
    ok("Lisa: not qualified (1 of 3 recruits), earned nothing, compressed out");

    const m = await getCompensationOverview(by["Michelle"]);
    assert.equal(m.slots[4].earned, 10);
    assert.deepEqual(m.levels, [3, 1, 3, 3, 1, 3, 1, 3]);
    assert.equal(m.teamSize, 18);
    ok("Michelle: slot 5 ($10); team of 18 across 8 levels");

    console.log("\nA reversed sale stops counting");
    await prisma.affiliateConversion.update({ where: { id: conv.id }, data: { status: "reversed" } });
    const t2 = await getCompensationOverview(by["Tyler"]);
    assert.equal(t2.overrideEarnedThisMonth, 0);
    assert.equal(t2.overrideEarnedLifetime, 0);
    assert.equal(t2.recent.length, 0);
    ok("Tyler's override disappears from totals and the recent list");

    console.log("\nALL CHECKS PASSED");
  } finally {
    await prisma.affiliateSettings.update({ where: { id: "global" }, data: { unilevelEnabled: before.unilevelEnabled } });
    await prisma.conversionOverride.deleteMany({ where: { affiliateId: { in: created } } });
    await prisma.affiliateConversion.deleteMany({ where: { affiliateId: { in: created } } });
    await prisma.notification.deleteMany({ where: { affiliateId: { in: created } } });
    await prisma.affiliate.updateMany({ where: { id: { in: created } }, data: { parentAffiliateId: null } });
    await prisma.affiliate.deleteMany({ where: { id: { in: created } } });
    console.log(`\ncleaned up ${created.length} test affiliates; unilevelEnabled restored to ${before.unilevelEnabled}`);
  }
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
