// Runs every Signups search and filter against a real (non-prod) database, to check the queries the admin
// Customers and Sales Reps pages build are accepted and that junk filter values are ignored.
//
//   export DATABASE_URL="$(grep "^DATABASE_URL=" .env.local | cut -d= -f2-)"
//   pnpm dlx tsx scripts/testSignupQueries.ts
import "dotenv/config"; // does not override an already-exported DATABASE_URL
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { customerWhere, repWhere, parseSignupQuery } from "../src/lib/admin/signupFilters";

const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
console.log("database host:", host);
if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");

const q = (params: string) => parseSignupQuery(new URLSearchParams(params));

async function main() {
  const total = await prisma.customerSignup.count();
  console.log("customers in dev db:", total, "| sales rep signups:", await prisma.salesRepSignup.count());

  const cases: [string, string][] = [
    ["search by email part", "q=dense"],
    ["search two words", "q=dense%20demon"],
    ["status active", "status=active"],
    ["status pending_payment", "status=pending_payment"],
    ["status complimentary", "status=complimentary"],
    ["plan basic", "plan=customer_basic"],
    ["plan agent", "plan=agent"],
    ["range 7 days", "range=7"],
    ["junk status ignored", "status=banana&plan=nope&range=zzz&page=-4"],
    ["combined", "q=a&status=active&plan=customer_basic&range=365&sort=oldest&page=2"],
  ];
  for (const [label, params] of cases) {
    const n = await prisma.customerSignup.count({ where: customerWhere(q(params)) });
    const rows = await prisma.customerSignup.findMany({ where: customerWhere(q(params)), take: 3 });
    console.log(`  customers · ${label}: ${n}`);
    assert.ok(rows.length <= 3);
  }
  assert.ok((await prisma.customerSignup.count({ where: customerWhere(q("q=dense")) })) >= 1, "densedemon should match q=dense");
  assert.equal(await prisma.customerSignup.count({ where: customerWhere(q("status=banana&plan=nope&range=zzz")) }), total, "junk filters must be ignored");
  assert.equal(q("page=-4").page, 1);

  for (const [label, params] of [["all", ""], ["pending", "status=pending"], ["search", "q=test"], ["type of sales", "q=pharma"], ["90d", "range=90&sort=oldest"]] as const) {
    const n = await prisma.salesRepSignup.count({ where: repWhere(q(params)) });
    console.log(`  sales reps · ${label}: ${n}`);
  }

  // The lookup the Sales Reps page does for approved reps' own membership.
  const emails = (await prisma.salesRepSignup.findMany({ take: 20, select: { email: true } })).map((r) => r.email);
  const memberships = await prisma.customerSignup.findMany({ where: { plan: "agent", email: { in: emails, mode: "insensitive" } } });
  console.log("  rep membership lookup ok:", memberships.length, "match(es)");
  console.log("\nAll query checks passed.");
}
main().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
