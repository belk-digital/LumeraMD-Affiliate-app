import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";

async function main() {
  const affiliate = await prisma.affiliate.findFirst({
    where: { status: "approved", ...(process.argv[2] ? { userEmail: process.argv[2] } : {}) },
    orderBy: { createdAt: "asc" },
  });
  if (!affiliate) {
    console.log("NONE");
    return;
  }
  const token = randomBytes(24).toString("hex");
  await prisma.affiliateLoginToken.create({
    data: { token, affiliateId: affiliate.id, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });
  console.log(JSON.stringify({ token, id: affiliate.id, email: affiliate.userEmail }));
}

main().finally(() => prisma.$disconnect());
