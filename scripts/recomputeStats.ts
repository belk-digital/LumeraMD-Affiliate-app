import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { updateAffiliateStats } from "../src/lib/affiliates/stats";

async function main() {
  const all = await prisma.affiliate.findMany({ orderBy: { createdAt: "asc" } });
  const snap = (a: (typeof all)[number]) =>
    `pend ${a.totalCommissionPending} | appr ${a.totalCommissionApproved} | paid ${a.totalCommissionPaid} | earned ${a.totalCommissionEarned}`;
  for (const a of all) {
    await updateAffiliateStats(a.id);
    const after = await prisma.affiliate.findUniqueOrThrow({ where: { id: a.id } });
    console.log(a.userEmail.padEnd(32), "\n   before:", snap(a), "\n   after: ", snap(after));
  }
  const withParent = await prisma.affiliateConversion.findMany({
    where: { parentAffiliateId: { not: null } },
    select: { shopifyOrderName: true, status: true, affiliateId: true, parentAffiliateId: true, parentCommissionAmount: true, commissionAmount: true },
  });
  console.log("override conversions:", withParent);
}
main().finally(() => prisma.$disconnect());
