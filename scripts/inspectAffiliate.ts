import "dotenv/config";
import { prisma } from "../src/lib/prisma";

prisma.affiliate
  .findUnique({ where: { referralSlug: "testaffiliate" } })
  .then((row) => console.log(JSON.stringify(row, null, 2)))
  .finally(() => prisma.$disconnect());
