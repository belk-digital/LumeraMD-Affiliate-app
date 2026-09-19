import "dotenv/config";
import { prisma } from "../src/lib/prisma";

prisma.affiliateConversion
  .findMany({ include: { affiliate: true } })
  .then((rows) => {
    console.log(JSON.stringify(rows, null, 2));
  })
  .finally(() => prisma.$disconnect());
