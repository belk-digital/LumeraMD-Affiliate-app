import "dotenv/config";
delete process.env.RESEND_API_KEY; // dev mode: log emails instead of sending
import { prisma } from "../src/lib/prisma";
import { attributeOrder } from "../src/lib/affiliates/commission";
import { updateAffiliateStats } from "../src/lib/affiliates/stats";
import { getTeamOverview, getAffiliateOverview } from "../src/lib/affiliates/dashboardData";

async function bal(id: string) {
  const a = await prisma.affiliate.findUniqueOrThrow({ where: { id } });
  return `pend ${a.totalCommissionPending} | appr ${a.totalCommissionApproved} | paid ${a.totalCommissionPaid} | earned ${a.totalCommissionEarned}`;
}

async function main() {
  const child = await prisma.affiliate.findFirstOrThrow({
    where: { parentAffiliateId: { not: null }, status: "approved" },
    include: { parentAffiliate: true },
  });
  const parent = child.parentAffiliate!;
  console.log("child:", child.userEmail, "| parent:", parent.userEmail, "| parent rate:", parent.parentOverrideRate);
  const started = new Date();
  const orderId = "TEST-OVERRIDE-" + Date.now();

  const conv = await attributeOrder({
    order: { id: orderId, name: "#OVR1", subtotalPrice: 133.33, totalDiscounts: 0, discountCodes: [], customerEmail: "buyer@example.com" },
    cookieAffiliateId: child.id,
    cookieClickId: null,
  });
  console.log("conversion:", { own: conv?.commissionAmount, parentAmt: conv?.parentCommissionAmount, rate: conv?.parentCommissionRate, parentId: conv?.parentAffiliateId === parent.id });
  console.log("child balances  (pending):", await bal(child.id));
  console.log("parent balances (pending):", await bal(parent.id));

  await prisma.affiliateConversion.update({ where: { id: conv!.id }, data: { status: "approved" } });
  await updateAffiliateStats(child.id);
  await updateAffiliateStats(parent.id);
  console.log("child balances  (approved):", await bal(child.id));
  console.log("parent balances (approved):", await bal(parent.id));

  const team = await getTeamOverview(parent.id);
  console.log("team KPIs:", JSON.stringify(team.kpis));
  console.log("earnedFromThem:", team.members.map((m) => [m.userEmail, m.earnedFromThem]));
  const ov = await getAffiliateOverview(parent.id, 30);
  console.log("parent overview commission KPI:", ov.kpis.commission, "| conversions:", ov.kpis.conversions.value);

  // reverse -> both balances drop back
  await prisma.affiliateConversion.update({ where: { id: conv!.id }, data: { status: "reversed" } });
  await updateAffiliateStats(child.id);
  await updateAffiliateStats(parent.id);
  console.log("child balances  (reversed):", await bal(child.id));
  console.log("parent balances (reversed):", await bal(parent.id));

  // cleanup
  await prisma.affiliateConversion.delete({ where: { id: conv!.id } });
  await prisma.notification.deleteMany({ where: { affiliateId: { in: [child.id, parent.id] }, createdAt: { gte: started } } });
  await updateAffiliateStats(child.id);
  await updateAffiliateStats(parent.id);
  console.log("cleaned up. parent:", await bal(parent.id));
}
main().finally(() => prisma.$disconnect());
