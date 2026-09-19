import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { updateAffiliateStats } from "../src/lib/affiliates/stats";
async function main() {
  const id = process.argv[2];
  const del = await prisma.affiliateClick.deleteMany({ where: { id } });
  const aff = await prisma.affiliate.findFirstOrThrow({ where: { userEmail: "test-affiliate@example.com" } });
  await updateAffiliateStats(aff.id);
  const a = await prisma.affiliate.findUniqueOrThrow({ where: { id: aff.id } });
  console.log("deleted clicks:", del.count, "| test-affiliate clicks now:", a.totalClicks);
}
main().finally(() => prisma.$disconnect());
