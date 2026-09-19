import "dotenv/config";
import { prisma } from "../src/lib/prisma";

prisma.affiliate
  .update({
    where: { id: "cmu620yv60000yovqhx9h1yph" },
    data: { minimumPayoutThreshold: 5 },
  })
  .then(() => console.log("done"))
  .finally(() => prisma.$disconnect());
