// End-to-end check of approving a sales rep signup into an affiliate, against a real database.
// Skips the Shopify discount code (so it never touches the live store) and logs emails instead of
// sending them. Refuses to run against production. All rows it creates are deleted at the end.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/testSalesRepApproval.ts
import "dotenv/config"; // does not override an already-exported DATABASE_URL
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  createAffiliateFromSalesRepSignup,
  SalesRepApprovalError,
} from "../src/lib/affiliates/createFromSalesRep";
import { provisionAffiliate } from "../src/lib/affiliates/createFromApplication";

const TAG = `e2e${Date.now()}`;
const email = (n: string) => `${TAG}-${n}@example.test`;
const ok = (label: string) => console.log("  ✓", label);

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  const referrer = await prisma.affiliate.create({
    data: { userEmail: email("referrer"), displayName: "Referrer", status: "approved", referralSlug: `${TAG}-referrer` },
  });
  const existing = await prisma.affiliate.create({
    data: { userEmail: email("taken"), displayName: "Taken", status: "approved", referralSlug: `${TAG}-taken` },
  });

  const named = await prisma.salesRepSignup.create({
    data: { email: email("jane"), firstName: "Jane", lastName: "Doe", referredByAffiliateId: referrer.id },
  });
  const emailOnly = await prisma.salesRepSignup.create({ data: { email: email("emailonly") } });
  const dup = await prisma.salesRepSignup.create({ data: { email: email("TAKEN").toUpperCase() } });

  try {
    console.log("\nApprove a named rep referred by someone");
    const aff = await createAffiliateFromSalesRepSignup(named.id, { skipShopifyDiscount: true });
    assert.equal(aff.userEmail, email("jane"));
    assert.equal(aff.displayName, "Jane Doe");
    assert.equal(aff.status, "approved");
    assert.equal(aff.parentAffiliateId, referrer.id);
    ok("affiliate created, approved, placed under the referrer");
    assert.match(aff.referralSlug, /^jane-doe-[a-z0-9]{4}$/);
    ok(`referral slug generated (${aff.referralSlug})`);

    const signup = await prisma.salesRepSignup.findUniqueOrThrow({ where: { id: named.id } });
    assert.equal(signup.status, "approved");
    assert.equal(signup.linkedAffiliateId, aff.id);
    ok("signup marked approved and linked to the affiliate");

    const welcome = await prisma.notification.count({ where: { affiliateId: aff.id, type: "welcome" } });
    const joined = await prisma.notification.count({ where: { affiliateId: referrer.id, type: "recruit_joined" } });
    assert.equal(welcome, 1);
    assert.equal(joined, 1);
    ok("rep gets a welcome notification; referrer is told someone joined");

    console.log("\nApproving twice is idempotent");
    const again = await createAffiliateFromSalesRepSignup(named.id, { skipShopifyDiscount: true });
    assert.equal(again.id, aff.id);
    assert.equal(await prisma.affiliate.count({ where: { userEmail: email("jane") } }), 1);
    ok("second approval returns the same affiliate, no duplicate");

    console.log("\nEmail-only signup (no name, no referrer)");
    const solo = await createAffiliateFromSalesRepSignup(emailOnly.id, { skipShopifyDiscount: true });
    assert.equal(solo.displayName, `${TAG}-emailonly`);
    assert.equal(solo.parentAffiliateId, null);
    ok("display name falls back to the email's local part; no parent");

    console.log("\nEmail already belongs to an affiliate (case-insensitive)");
    await assert.rejects(
      createAffiliateFromSalesRepSignup(dup.id, { skipShopifyDiscount: true }),
      (e: unknown) => e instanceof SalesRepApprovalError && e.status === 409,
    );
    const dupAfter = await prisma.salesRepSignup.findUniqueOrThrow({ where: { id: dup.id } });
    assert.equal(dupAfter.status, "pending");
    assert.equal(dupAfter.linkedAffiliateId, null);
    ok("rejected with 409; signup stays pending and unlinked");

    console.log("\nUnknown signup id");
    await assert.rejects(
      createAffiliateFromSalesRepSignup("does-not-exist", { skipShopifyDiscount: true }),
      (e: unknown) => e instanceof SalesRepApprovalError && e.status === 404,
    );
    ok("404");

    console.log("\nIf linking the signup fails, the new affiliate is rolled back");
    await assert.rejects(
      provisionAffiliate({
        email: email("rollback"),
        displayName: "Rollback",
        parentAffiliateId: null,
        skipShopifyDiscount: true,
        afterCreate: async () => {
          throw new Error("simulated link failure");
        },
      }),
      /simulated link failure/,
    );
    assert.equal(await prisma.affiliate.count({ where: { userEmail: email("rollback") } }), 0);
    ok("no orphan affiliate left behind, so a retry is not blocked");

    console.log("\nALL CHECKS PASSED");
  } finally {
    const aff = await prisma.affiliate.findMany({ where: { userEmail: { startsWith: TAG } } });
    const ids = aff.map((a) => a.id);
    await prisma.notification.deleteMany({ where: { affiliateId: { in: ids } } });
    await prisma.affiliate.updateMany({ where: { id: { in: ids } }, data: { parentAffiliateId: null } });
    await prisma.affiliate.deleteMany({ where: { id: { in: ids } } });
    const s = await prisma.salesRepSignup.deleteMany({ where: { email: { startsWith: TAG, mode: "insensitive" } } });
    console.log(`\ncleaned up ${ids.length} test affiliates and ${s.count} signups`);
  }
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
