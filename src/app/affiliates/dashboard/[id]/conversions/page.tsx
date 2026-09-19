import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StatusPill from "@/components/StatusPill";
import { formatMoney } from "@/lib/format";
import { requireAffiliateAccess } from "@/lib/affiliates/access";
import DashboardShell from "../DashboardShell";
import { Card, Table, fmtDate } from "../ui";

export default async function ConversionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAffiliateAccess(id);

  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) notFound();

  const conversions = await prisma.affiliateConversion.findMany({
    where: { affiliateId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const referralLink = `${process.env.APP_BASE_URL ?? ""}/ref/${affiliate.referralSlug}`;

  return (
    <DashboardShell
      affiliateId={affiliate.id}
      affiliateEmail={affiliate.userEmail}
      displayName={affiliate.displayName}
      referralLink={referralLink}
    >
      <div className="space-y-6 p-4 md:p-6">
        <div className="animate-fade-up">
          <h1 className="font-heading text-2xl font-semibold text-ink">Conversions</h1>
          <p className="mt-1 text-sm text-ink/60">
            Every order credited to you through your link or discount code.
          </p>
        </div>

        <Card title="All conversions" delay={100}>
          <Table
            headers={["Order", "Status", "Commission", "Date"]}
            empty="No conversions yet — share your link to get started."
            rows={conversions.map((c) => [
              <span key="o" className="font-medium text-ink">
                {c.shopifyOrderName ?? "—"}
              </span>,
              <StatusPill key="s" status={c.status} />,
              formatMoney(c.commissionAmount),
              fmtDate(c.createdAt),
            ])}
          />
        </Card>
      </div>
    </DashboardShell>
  );
}
