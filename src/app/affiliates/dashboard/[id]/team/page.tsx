import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTeamOverview } from "@/lib/affiliates/dashboardData";
import { requireAffiliateAccess } from "@/lib/affiliates/access";
import DashboardShell from "../DashboardShell";
import TeamClient from "./TeamClient";


export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAffiliateAccess(id);

  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) notFound();

  const { members, kpis, days } = await getTeamOverview(id);

  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const referralLink = `${appBaseUrl}/ref/${affiliate.referralSlug}`;
  const inviteLink = `${appBaseUrl}/affiliates/apply?ref=${affiliate.referralSlug}`;

  return (
    <DashboardShell
      affiliateId={affiliate.id}
      affiliateEmail={affiliate.userEmail}
      displayName={affiliate.displayName}
      referralLink={referralLink}
      discountCode={affiliate.shopifyDiscountCode}
    >
      <div className="p-4 md:p-6 lg:p-8">
        <TeamClient 
          affiliateId={affiliate.id}
          members={members}
          kpis={kpis}
          inviteLink={inviteLink}
        />
      </div>
    </DashboardShell>
  );
}
