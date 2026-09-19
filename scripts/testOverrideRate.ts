import "dotenv/config";
delete process.env.RESEND_API_KEY;
import { prisma } from "../src/lib/prisma";
import { attributeOrder } from "../src/lib/affiliates/commission";
import { updateAffiliateStats } from "../src/lib/affiliates/stats";

async function main() {
  const child = await prisma.affiliate.findFirstOrThrow({
    where: { parentAffiliateId: { not: null }, status: "approved" },
    include: { parentAffiliate: true },
  });
  const parent = child.parentAffiliate!;
  const original = parent.parentOverrideRate;
  const settings = await prisma.affiliateSettings.findUniqueOrThrow({ where: { id: "global" } });
  console.log("parent original rate:", original, "| global default:", settings.defaultParentOverrideRate);
  const started = new Date();
  const created: string[] = [];

  async function run(label: string, rate: number | null) {
    await prisma.affiliate.update({ where: { id: parent.id }, data: { parentOverrideRate: rate } });
    const conv = await attributeOrder({
      order: { id: `TEST-RATE-${label}-${Date.now()}`, name: "#RATE", subtotalPrice: 100, totalDiscounts: 0, discountCodes: [], customerEmail: "buyer@example.com" },
      cookieAffiliateId: child.id,
      cookieClickId: null,
    });
    created.push(conv!.id);
    console.log(`${label.padEnd(8)} stored rate=${rate} -> conversion override rate=${conv?.parentCommissionRate} amount=${conv?.parentCommissionAmount}`);
  }

  await run("blank", null);
  await run("custom5", 5);
  await run("zero", 0);

  await prisma.affiliateConversion.deleteMany({ where: { id: { in: created } } });
  await prisma.notification.deleteMany({ where: { affiliateId: { in: [child.id, parent.id] }, createdAt: { gte: started } } });
  await prisma.affiliate.update({ where: { id: parent.id }, data: { parentOverrideRate: original } });
  await updateAffiliateStats(child.id);
  await updateAffiliateStats(parent.id);
  const after = await prisma.affiliate.findUniqueOrThrow({ where: { id: parent.id } });
  console.log("restored rate:", after.parentOverrideRate, "| parent pending:", after.totalCommissionPending);
}
main().finally(() => prisma.$disconnect());
