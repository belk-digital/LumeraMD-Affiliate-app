import "dotenv/config";
import { prisma } from "../src/lib/prisma";

prisma.affiliateLoginToken
  .findFirst({ where: { usedAt: null }, orderBy: { createdAt: "desc" } })
  .then((t) => console.log(t?.token ?? "NONE"))
  .finally(() => prisma.$disconnect());
