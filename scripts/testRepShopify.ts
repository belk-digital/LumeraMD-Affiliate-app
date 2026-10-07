// Real-Shopify check of the rep membership path: approval -> first payment creates the member's
// 15% discount code in the LIVE store, then cancelling removes it. Uses the testing database,
// logs emails instead of sending, and always deletes the code and rows it made.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/testRepShopify.ts
import "dotenv/config";
delete process.env.RESEND_API_KEY;
delete process.env.SKIP_SHOPIFY; // this test deliberately talks to Shopify
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { createAffiliateFromSalesRepSignup } from "../src/lib/affiliates/createFromSalesRep";
import { recordMembershipPayment, cancelMembership } from "../src/lib/membership/lifecycle";
import { shopifyGraphQL, deleteDiscountCodeByString } from "../src/lib/shopify/client";

const TAG = `rs${Date.now()}`;
const email = `${TAG}@example.test`;
const ok = (l: string) => console.log("  ✓", l);

async function lookup(code: string) {
  const r = await shopifyGraphQL<{ codeDiscountNodeByCode: { codeDiscount: { title: string; customerGets: { value: { percentage?: number } } } } | null }>(
    `query($code:String!){ codeDiscountNodeByCode(code:$code){ codeDiscount{ ... on DiscountCodeBasic { title customerGets { value { ... on DiscountPercentage { percentage } } } } } } }`,
    { code },
  );
  return r.codeDiscountNodeByCode;
}

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  console.log("database host:", host);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production DB.");

  const rep = await prisma.salesRepSignup.create({ data: { email, firstName: "Shop", lastName: "Test" } });
  let code: string | null = null;
  try {
    await createAffiliateFromSalesRepSignup(rep.id, { skipShopifyDiscount: true });
    const member = await prisma.customerSignup.findFirstOrThrow({ where: { email } });
    assert.equal(member.plan, "agent");
    const res = await recordMembershipPayment({ customerId: member.id, amount: 79, source: "manual", note: "shopify test" });
    assert.deepEqual(res.warnings, []);
    code = res.customer.memberDiscountCode;
    assert.ok(code && res.customer.memberDiscountActive);
    ok(`payment recorded, code ${code} marked active, no warnings`);

    const node = await lookup(code!);
    assert.ok(node, "code should exist in Shopify");
    assert.equal(node!.codeDiscount.customerGets.value.percentage, 0.15);
    ok("code exists in Shopify at 15% off");

    await cancelMembership(member.id);
    assert.equal(await lookup(code!), null);
    ok("cancelling removed the code from Shopify");
    code = null;
  } finally {
    if (code) {
      await deleteDiscountCodeByString(code).catch(() => {});
      console.log("  (cleaned up leftover Shopify code)", code);
    }
    const aff = await prisma.affiliate.findMany({ where: { userEmail: email } });
    const ids = aff.map((a) => a.id);
    await prisma.notification.deleteMany({ where: { affiliateId: { in: ids } } });
    await prisma.affiliate.deleteMany({ where: { id: { in: ids } } });
    await prisma.salesRepSignup.deleteMany({ where: { email } });
    await prisma.customerSignup.deleteMany({ where: { email } });
    console.log("cleaned up test rows");
  }
}
main().catch((e) => { console.error("\nFAILED:", e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
