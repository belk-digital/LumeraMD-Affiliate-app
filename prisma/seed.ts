import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });

  const affiliate = await prisma.affiliate.upsert({
    where: { userEmail: "test-affiliate@example.com" },
    update: {},
    create: {
      userEmail: "test-affiliate@example.com",
      status: "approved",
      referralSlug: "testaffiliate",
      shopifyDiscountCode: "TESTAFF10",
      commissionRate: 10,
      commissionType: "percent",
    },
  });

  console.log("Seeded affiliate:", affiliate.referralSlug, affiliate.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
