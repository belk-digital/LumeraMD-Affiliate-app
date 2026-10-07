// 90-day activity cycle against a real database: grandfathering, new affiliates, recruit counting,
// rollover, suspension, warnings, override qualification and reactivation. Emails are skipped,
// production is refused, and every row (and the settings it changes) is restored at the end.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/testActivityCycle.ts
import "dotenv/config";
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  activityRulesFromSettings,
  isCurrentlyActive,
  meetsRequirement,
  processActivityCycles,
  startCycle,
  startCycleIfEnabled,
  startCyclesForExisting,
} from "../src/lib/affiliates/activity";
import { isAffiliateQualified, monthWindow, planFromSettings } from "../src/lib/affiliates/unilevel";

const TAG = `ac${Date.now()}`;
const DAY = 86_400_000;
const ok = (l: string) => console.log("  ✓", l);
let n = 0;
const mk = (parent?: string) => {
  n += 1;
  return prisma.affiliate.create({
    data: {
      userEmail: `${TAG}-${n}@example.test`,
      displayName: `T${n}`,
      status: "approved",
      referralSlug: `${TAG}-${n}`,
      parentAffiliateId: parent ?? null,
    },
  });
};
const fresh = (id: string) => prisma.affiliate.findUniqueOrThrow({ where: { id } });

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  const saved = await prisma.affiliateSettings.upsert({ where: { id: "global" }, update: {}, create: { id: "global" } });
  const set = (d: Record<string, unknown>) => prisma.affiliateSettings.update({ where: { id: "global" }, data: d });
  const rulesNow = async () =>
    activityRulesFromSettings(await prisma.affiliateSettings.findUniqueOrThrow({ where: { id: "global" } }));

  try {
    console.log("\nProgram off: nothing happens");
    await set({ activityEnabled: false, activityCycleDays: 90, activityRequiredRecruits: 3, activityMinSales: 500 });
    const idle = await mk();
    const off = await processActivityCycles(new Date(Date.now() + 500 * DAY), { sendEmail: false });
    assert.deepEqual([off.initialized, off.rolledOver, off.suspended, off.warned], [0, 0, 0, 0]);
    assert.equal((await fresh(idle.id)).status, "approved");
    assert.equal(await startCycleIfEnabled(idle.id), null);
    ok("job is a no-op and new affiliates get no cycle while it is off");

    console.log("\nTurning it on");
    await set({ activityEnabled: true });
    const rules = await rulesNow();
    assert.equal(meetsRequirement({ recruits: 3, sales: 0 }, rules), true);
    assert.equal(meetsRequirement({ recruits: 2, sales: 499 }, rules), false);
    assert.equal(meetsRequirement({ recruits: 0, sales: 500 }, rules), true);
    assert.equal(meetsRequirement({ recruits: 0, sales: 10_000 }, { ...rules, minSales: 0 }), false);
    ok("recruits OR sales meets it; the sales route is off when the target is 0");

    await startCyclesForExisting(rules);
    const old = await fresh(idle.id);
    assert.ok(old.cycleEndsAt && old.activeUntil && old.activeUntil.getTime() === old.cycleEndsAt.getTime());
    assert.equal(await isCurrentlyActive(old, rules), true);
    ok("existing affiliates start a grandfathered cycle and are active");

    const brandNew = await mk();
    await startCycleIfEnabled(brandNew.id);
    const bn = await fresh(brandNew.id);
    assert.ok(bn.cycleStartedAt && bn.cycleEndsAt);
    assert.equal(bn.activeUntil, null);
    assert.equal(await isCurrentlyActive(bn, rules), false);
    ok("a brand-new affiliate is NOT active until they meet the requirement");
    for (let i = 0; i < 3; i++) await mk(brandNew.id);
    assert.equal(await isCurrentlyActive(await fresh(brandNew.id), rules), true);
    ok("recruiting 3 makes them active");

    console.log("\nEnd of cycle");
    const later = new Date(Date.now() + 91 * DAY);
    const failer = await mk();
    await startCycle(failer.id, rules, { grandfather: true });
    const passer = await mk();
    await startCycle(passer.id, rules, { grandfather: true });
    for (let i = 0; i < 3; i++) await mk(passer.id);
    const run = await processActivityCycles(later, { sendEmail: false });
    assert.ok(run.suspended >= 1 && run.rolledOver >= 1);
    const f = await fresh(failer.id);
    assert.equal(f.status, "suspended");
    assert.match(f.suspendReason ?? "", /Inactive/);
    assert.equal(await prisma.notification.count({ where: { affiliateId: f.id, type: "activity_suspended" } }), 1);
    ok("an affiliate who missed the requirement is suspended, with a reason and a notification");
    const p = await fresh(passer.id);
    assert.equal(p.status, "approved");
    assert.ok(p.cycleStartedAt!.getTime() > Date.now() + 80 * DAY);
    assert.equal(p.activeUntil!.getTime(), p.cycleEndsAt!.getTime());
    assert.equal(await isCurrentlyActive(p, rules, later), true);
    ok("one who met it rolls into a new cycle and stays active even though the counts reset");

    console.log("\nWarnings");
    const warned = await mk();
    await startCycle(warned.id, rules, { grandfather: true });
    const w10 = await processActivityCycles(new Date(Date.now() + 80 * DAY), { sendEmail: false });
    assert.ok(w10.warned >= 1);
    assert.equal((await fresh(warned.id)).cycleWarningStage, 1);
    await processActivityCycles(new Date(Date.now() + 80 * DAY), { sendEmail: false });
    assert.equal(await prisma.notification.count({ where: { affiliateId: warned.id, type: "activity_warning" } }), 1);
    await processActivityCycles(new Date(Date.now() + 88 * DAY), { sendEmail: false });
    assert.equal((await fresh(warned.id)).cycleWarningStage, 2);
    assert.equal(await prisma.notification.count({ where: { affiliateId: warned.id, type: "activity_warning" } }), 2);
    ok("warned once at 14 days and once at 3 days, never twice");
    assert.equal(await prisma.notification.count({ where: { affiliateId: passer.id, type: "activity_warning" } }), 0);
    ok("someone who already met it is not warned");

    console.log("\nOverrides use the activity rule");
    await set({ unilevelRequiredRecruits: 2, activityRequiredRecruits: 2 });
    const settings2 = await prisma.affiliateSettings.findUniqueOrThrow({ where: { id: "global" } });
    const rules2 = activityRulesFromSettings(settings2);
    const plan = planFromSettings(settings2);
    const win = monthWindow(new Date());
    const upline = await mk();
    await startCycle(upline.id, rules2, { grandfather: false });
    const r1 = await mk(upline.id);
    const r2 = await mk(upline.id);
    for (const r of [r1, r2]) await startCycle(r.id, rules2, { grandfather: false });
    assert.equal(await isAffiliateQualified(await fresh(upline.id), plan, win, rules2), false);
    ok("2 recruits who are not active yet do not qualify an upline");
    for (const r of [r1, r2]) {
      await mk(r.id);
      await mk(r.id);
    }
    assert.equal(await isAffiliateQualified(await fresh(upline.id), plan, win, rules2), true);
    ok("once those recruits are active (each recruited 2), the upline qualifies, with no monthly sales needed");

    console.log("\nReactivation");
    await startCycleIfEnabled(failer.id);
    await prisma.affiliate.update({ where: { id: failer.id }, data: { status: "approved", suspendReason: null } });
    const re = await fresh(failer.id);
    assert.ok(re.cycleEndsAt!.getTime() > Date.now() + 80 * DAY);
    assert.equal(re.activeUntil, null);
    ok("a reactivated affiliate gets a fresh cycle and must meet the requirement");
  } finally {
    await prisma.affiliateSettings.update({
      where: { id: "global" },
      data: {
        activityEnabled: saved.activityEnabled,
        activityCycleDays: saved.activityCycleDays,
        activityRequiredRecruits: saved.activityRequiredRecruits,
        activityMinSales: saved.activityMinSales,
        unilevelRequiredRecruits: saved.unilevelRequiredRecruits,
      },
    });
    const all = await prisma.affiliate.findMany({ where: { userEmail: { startsWith: TAG } } });
    const ids = all.map((a) => a.id);
    await prisma.notification.deleteMany({ where: { affiliateId: { in: ids } } });
    await prisma.affiliate.updateMany({ where: { id: { in: ids } }, data: { parentAffiliateId: null } });
    await prisma.affiliate.deleteMany({ where: { id: { in: ids } } });
    console.log(`\ncleaned up ${ids.length} affiliates and restored settings`);
  }
}
main()
  .catch((e) => {
    console.error("\nFAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
