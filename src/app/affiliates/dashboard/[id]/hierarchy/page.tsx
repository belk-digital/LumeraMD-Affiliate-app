import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAffiliateAccess } from "@/lib/affiliates/access";
import { getAgentHierarchy } from "@/lib/affiliates/hierarchy";
import { canSeeTeam } from "@/lib/affiliates/team";
import { hasMembership } from "@/lib/customers/crossLinks";
import HierarchyTree from "@/components/hierarchy/HierarchyTree";
import DashboardShell from "../DashboardShell";

export const dynamic = "force-dynamic";

export default async function HierarchyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAffiliateAccess(id);

  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) notFound();

  const view = await getAgentHierarchy(id);
  if (!view) notFound();

  const appBaseUrl = process.env.APP_BASE_URL ?? "";

  return (
    <DashboardShell
      affiliateId={affiliate.id}
      affiliateEmail={affiliate.userEmail}
      displayName={affiliate.displayName}
      referralLink={`${appBaseUrl}/ref/${affiliate.referralSlug}`}
      discountCode={affiliate.shopifyDiscountCode}
      showTeam={await canSeeTeam(affiliate)}
      hasMembership={await hasMembership(affiliate.userEmail)}
    >
      <div className="p-4 md:p-6 lg:p-8">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-ink">Hierarchy</h1>
          <p className="mt-1 text-sm text-slate-500">
            You, the {view.uplineCount} qualified {view.uplineCount === 1 ? "level" : "levels"} above you (up to{" "}
            {view.maxUplines}), and your team below. Uplines who aren&apos;t currently qualified are not shown.
          </p>
        </div>
        <HierarchyTree root={view.root} />
      </div>
    </DashboardShell>
  );
}
