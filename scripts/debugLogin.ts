import "dotenv/config";
import { prisma } from "../src/lib/prisma";
async function main() {
  const affs = await prisma.affiliate.findMany({ select: { id: true, userEmail: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 });
  console.log("affiliates", affs);
  const toks = await prisma.affiliateLoginToken.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { affiliateId: true, createdAt: true, usedAt: true, expiresAt: true } });
  console.log("tokens", toks);
}
main().finally(() => prisma.$disconnect());
