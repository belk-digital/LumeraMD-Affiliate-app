import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAffiliateAccess } from "@/lib/affiliates/access";
import DashboardShell from "../DashboardShell";
import { PayoutsClient } from "./PayoutsClient";

export default async function PayoutsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAffiliateAccess(id);

  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) notFound();

  const payouts = await prisma.affiliatePayout.findMany({
    where: { affiliateId: id },
    orderBy: { createdAt: "desc" },
  });

  const inFlight = payouts
    .filter((p) => p.status === "pending" || p.status === "approved")
    .reduce((acc, p) => acc + p.amount, 0);
  const available = Math.max(affiliate.totalCommissionApproved - inFlight, 0);

  // Calculate Paid Payouts Stats
  const paidPayouts = payouts.filter(p => p.status === 'paid');
  const paidAmount = paidPayouts.reduce((acc, p) => acc + p.amount, 0);
  const paidCount = paidPayouts.length;

  // Calculate Pending Payouts Stats
  const pendingPayouts = payouts.filter(p => p.status === 'pending');
  const pendingAmount = pendingPayouts.reduce((acc, p) => acc + p.amount, 0);
  const pendingCount = pendingPayouts.length;

  const stats = {
    totalEarned: affiliate.totalCommissionEarned, // using earned commission
    pending: { amount: pendingAmount, count: pendingCount },
    paid: { amount: paidAmount, count: paidCount },
  };

  const referralLink = `${process.env.APP_BASE_URL ?? ""}/ref/${affiliate.referralSlug}`;

  return (
    <DashboardShell
      affiliateId={affiliate.id}
      affiliateEmail={affiliate.userEmail}
      displayName={affiliate.displayName}
      referralLink={referralLink}
      discountCode={affiliate.shopifyDiscountCode}
    >
      <PayoutsClient 
        affiliate={affiliate}
        payouts={payouts}
        stats={stats}
        available={available}
      />
    </DashboardShell>
  );
}
