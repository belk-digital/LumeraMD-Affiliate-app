// End-to-end check of the unilevel plan against a real database, using the client's spreadsheet
// example (Ashley sells $1,000 with 8 uplines; 5 qualified fill the slots, 3 compressed out).
//
// Run against the TESTING branch only:
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/testUnilevel.ts
//
// All rows it creates are tagged and deleted at the end, and the unilevel switch is restored.
import "dotenv/config"; // does not override an already-exported DATABASE_URL
delete process.env.RESEND_API_KEY; // dev mode: log emails instead of sending
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { attributeOrder } from "../src/lib/affiliates/commission";
import { updateStatsForConversion } from "../src/lib/affiliates/stats";
import { getTeamOverview } from "../src/lib/affiliates/dashboardData";

const TAG = `e2e${Date.now()}`;
const created: string[] = [];

async function makeAffiliate(name: string, parentId: string | null) {
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
  if (host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  const before = await prisma.affiliateSettings.upsert({ where: { id: "global" }, update: {}, create: { id: "global" } });

  // Genealogy, nearest-first above Ashley: Tyler, Lisa, Mason, Kevin, Sarah, Greg, Jordan, Michelle.
  // "Qualified" = 3 approved direct recruits, so qualified uplines get two filler recruits.
  const chainNames = ["Michelle", "Jordan", "Greg", "Sarah", "Kevin", "Mason", "Lisa", "Tyler"];
  const qualified = new Set(["Tyler", "Mason", "Sarah", "Greg", "Michelle"]);
  const byName: Record<string, string> = {};
  let parent: string | null = null;
  for (const n of chainNames) {
    const a = await makeAffiliate(n, parent);
    byName[n] = a.id;
    parent = a.id;
  }
  const ashley = await makeAffiliate("Ashley", byName["Tyler"]);
  for (const n of chainNames) {
    if (qualified.has(n)) {
      // Each qualified upline already has one recruit (the next person down the chain).
      await makeAffiliate(`${n}fillerA`, byName[n]);
      await makeAffiliate(`${n}fillerB`, byName[n]);
    }
  }
  // Tyler's recruits: Ashley + 2 fillers (made above) = 3. Others counted the same way.

  // Ashley already has $9,000 of sales this month, so this $1,000 order puts her at $10,000 (20%).
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

  const ok = (label: string) => console.log("  ✓", label);

  try {
    await prisma.affiliateSettings.update({ where: { id: "global" }, data: { unilevelEnabled: true } });

    console.log("\nUnilevel ON — Ashley's $1,000 order");
    const conv = await attributeOrder({
      order: { id: `${TAG}-o1`, name: "#E2E1", subtotalPrice: 1000, totalDiscounts: 0, discountCodes: [], customerEmail: "buyer@example.test" },
      cookieAffiliateId: ashley.id,
      cookieClickId: null,
    });
    assert.ok(conv);
    assert.equal(conv.commissionAmount, 200);
    assert.equal(conv.commissionRate, 20);
    assert.equal(conv.parentAffiliateId, null); // legacy parent columns unused in unilevel mode
    ok("seller earns 20% = $200");

    const rows = await prisma.conversionOverride.findMany({ where: { conversionId: conv.id }, orderBy: { slot: "asc" } });
    const idToName = Object.fromEntries(Object.entries(byName).map(([n, id]) => [id, n]));
    const got = rows.map((r) => [idToName[r.affiliateId], r.slot, r.rate, r.amount]);
    console.log("  overrides:", JSON.stringify(got));
    assert.deepEqual(got, [["Tyler", 1, 5, 50], ["Mason", 2, 3, 30], ["Sarah", 3, 3, 30], ["Greg", 4, 3, 30], ["Michelle", 5, 1, 10]]);
    ok("Tyler 5% / Mason 3% / Sarah 3% / Greg 3% / Michelle 1%; Lisa, Kevin, Jordan compressed");
    assert.equal(rows.reduce((s, r) => s + r.amount, 0), 150);
    ok("overrides total $150, company keeps $0");

    const bal = async (n: string) => (await prisma.affiliate.findUniqueOrThrow({ where: { id: byName[n] } }));
    assert.equal((await bal("Tyler")).totalCommissionPending, 50);
    assert.equal((await bal("Lisa")).totalCommissionPending, 0);
    ok("pending balances updated (Tyler $50, Lisa $0)");

    const team = await getTeamOverview(byName["Tyler"]);
    assert.equal(team.kpis.earnings.value, 50);
    ok("team dashboard shows Tyler's $50");

    await prisma.affiliateConversion.update({ where: { id: conv.id }, data: { status: "approved" } });
    await updateStatsForConversion(conv);
    assert.equal((await bal("Greg")).totalCommissionApproved, 30);
    ok("after approval, Greg's $30 is available");

    await prisma.affiliateConversion.update({ where: { id: conv.id }, data: { status: "reversed" } });
    await updateStatsForConversion(conv);
    assert.equal((await bal("Greg")).totalCommissionApproved, 0);
    assert.equal((await bal("Michelle")).totalCommissionEarned, 0);
    ok("reversal zeroes every upline's balance");

    console.log("\nUnilevel OFF — legacy single-parent override still works");
    await prisma.affiliateSettings.update({ where: { id: "global" }, data: { unilevelEnabled: false } });
    const legacy = await attributeOrder({
      order: { id: `${TAG}-o2`, name: "#E2E2", subtotalPrice: 1000, totalDiscounts: 0, discountCodes: [], customerEmail: "buyer@example.test" },
      cookieAffiliateId: ashley.id,
      cookieClickId: null,
    });
    assert.ok(legacy);
    assert.equal(legacy.commissionAmount, 100); // ashley's stored flat 10%
    assert.equal(legacy.parentAffiliateId, byName["Tyler"]);
    assert.equal(legacy.parentCommissionAmount, before.defaultParentOverrideRate * 10); // team override % of $1,000
    assert.equal(await prisma.conversionOverride.count({ where: { conversionId: legacy.id } }), 0);
    ok(`flat 10% seller + ${before.defaultParentOverrideRate}% to direct parent, no override rows`);

    console.log("\nALL CHECKS PASSED");
  } finally {
    await prisma.affiliateSettings.update({
      where: { id: "global" },
      data: {
        unilevelEnabled: before.unilevelEnabled,
      },
    });
    const ids = created;
    await prisma.conversionOverride.deleteMany({ where: { affiliateId: { in: ids } } });
    await prisma.affiliateConversion.deleteMany({ where: { affiliateId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { affiliateId: { in: ids } } });
    await prisma.affiliate.updateMany({ where: { id: { in: ids } }, data: { parentAffiliateId: null } });
    await prisma.affiliate.deleteMany({ where: { id: { in: ids } } });
    console.log(`\ncleaned up ${ids.length} test affiliates; unilevelEnabled restored to ${before.unilevelEnabled}`);
  }
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
