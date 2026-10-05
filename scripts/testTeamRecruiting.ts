// Checks the admin "can recruit a team" switch against a real database: who can be recruited under
// whom, the default for new affiliates, and when the Team page is shown. Refuses to run against
// production, never calls Shopify, never sends email, and deletes everything it creates.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/testTeamRecruiting.ts
import "dotenv/config"; // does not override an already-exported DATABASE_URL
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { provisionAffiliate } from "../src/lib/affiliates/createFromApplication";
import { canSeeTeam } from "../src/lib/affiliates/team";
import { getInviter } from "../src/lib/signup";

const TAG = `e2e${Date.now()}`;
const ok = (label: string) => console.log("  ✓", label);
const email = (n: string) => `${TAG}-${n}@example.test`;

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  const settingsBefore = await prisma.affiliateSettings.upsert({ where: { id: "global" }, update: {}, create: { id: "global" } });
  const recruiter = await prisma.affiliate.create({
    data: { userEmail: email("recruiter"), displayName: "Recruiter", status: "approved", referralSlug: `${TAG}-recruiter` },
  });
  const make = (name: string, parentAffiliateId: string | null) =>
    provisionAffiliate({ email: email(name), displayName: name, parentAffiliateId, skipShopifyDiscount: true });

  try {
    console.log("\nDefaults");
    assert.equal(recruiter.canRecruit, true);
    ok("existing/new rows default to allowed, so nobody loses the ability on deploy");

    console.log("\nAllowed recruiter");
    const first = await make("first", recruiter.id);
    assert.equal(first.parentAffiliateId, recruiter.id);
    assert.ok(await getInviter(recruiter.referralSlug, { forTeam: true }));
    ok("a signup approved under them joins their team; their invite link is valid");

    console.log("\nSwitched off");
    await prisma.affiliate.update({ where: { id: recruiter.id }, data: { canRecruit: false } });
    const second = await make("second", recruiter.id);
    assert.equal(second.parentAffiliateId, null);
    ok("a signup submitted earlier but approved after the switch is NOT placed under them");
    assert.equal(await getInviter(recruiter.referralSlug, { forTeam: true }), null);
    ok("their invite link no longer counts as an inviter for team signups");
    assert.ok(await getInviter(recruiter.referralSlug));
    ok("but the same link is still a valid referral for customers (membership signups)");
    const stillThere = await prisma.affiliate.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(stillThere.parentAffiliateId, recruiter.id);
    ok("their existing team member is untouched");

    console.log("\nWhen the Team page shows");
    const lone = await prisma.affiliate.create({
      data: { userEmail: email("lone"), displayName: "Lone", status: "approved", referralSlug: `${TAG}-lone`, canRecruit: false },
    });
    assert.equal(await canSeeTeam({ id: lone.id, canRecruit: false }), false);
    ok("off and no team -> hidden");
    assert.equal(await canSeeTeam({ id: recruiter.id, canRecruit: false }), true);
    ok("off but already has team members -> still visible (so they can see them)");
    assert.equal(await canSeeTeam({ id: lone.id, canRecruit: true }), true);
    ok("on -> visible even with an empty team");

    console.log("\nSwitched back on");
    await prisma.affiliate.update({ where: { id: recruiter.id }, data: { canRecruit: true } });
    const third = await make("third", recruiter.id);
    assert.equal(third.parentAffiliateId, recruiter.id);
    assert.ok(await getInviter(recruiter.referralSlug, { forTeam: true }));
    ok("recruiting works again immediately");

    console.log("\nDefault for new affiliates");
    await prisma.affiliateSettings.update({ where: { id: "global" }, data: { defaultCanRecruit: false } });
    const noRecruit = await make("newoff", null);
    assert.equal(noRecruit.canRecruit, false);
    await prisma.affiliateSettings.update({ where: { id: "global" }, data: { defaultCanRecruit: true } });
    const yesRecruit = await make("newon", null);
    assert.equal(yesRecruit.canRecruit, true);
    ok("new affiliates take the program default (off -> blocked, on -> allowed)");

    console.log("\nALL CHECKS PASSED");
  } finally {
    await prisma.affiliateSettings.update({ where: { id: "global" }, data: { defaultCanRecruit: settingsBefore.defaultCanRecruit } });
    const rows = await prisma.affiliate.findMany({ where: { userEmail: { startsWith: TAG } }, select: { id: true } });
    const ids = rows.map((r) => r.id);
    await prisma.notification.deleteMany({ where: { affiliateId: { in: ids } } });
    await prisma.affiliate.updateMany({ where: { id: { in: ids } }, data: { parentAffiliateId: null } });
    await prisma.affiliate.deleteMany({ where: { id: { in: ids } } });
    console.log(`\ncleaned up ${ids.length} test affiliates; defaultCanRecruit restored to ${settingsBefore.defaultCanRecruit}`);
  }
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
