import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StatusPill from "@/components/StatusPill";
import { formatMoney } from "@/lib/format";
import { requireAffiliateAccess } from "@/lib/affiliates/access";
import DashboardShell from "../DashboardShell";
import PayoutForm from "../PayoutForm";
import { Card, Table, fmtDate } from "../ui";

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

  const savedDestination =
    affiliate.payoutDetails &&
    typeof affiliate.payoutDetails === "object" &&
    "destination" in affiliate.payoutDetails
      ? String((affiliate.payoutDetails as { destination: unknown }).destination ?? "")
      : "";

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
          <h1 className="font-heading text-2xl font-semibold text-ink">Payouts</h1>
          <p className="mt-1 text-sm text-ink/60">
            Request a payout and follow the status of past requests.
          </p>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          <Card title="Request a payout" delay={100} className="min-w-0">
            <PayoutForm
              available={available}
              minimumThreshold={affiliate.minimumPayoutThreshold}
              defaultMethod={affiliate.payoutMethod ?? undefined}
              defaultDestination={savedDestination}
            />
          </Card>
          <Card title="Payout history" delay={160} className="min-w-0">
            <Table
              headers={["Amount", "Method", "Status", "Date"]}
              empty="No payouts yet."
              rows={payouts.map((p) => [
                <span key="a" className="font-medium text-ink">
                  {formatMoney(p.amount)}
                </span>,
                <span key="m" className="capitalize">
                  {p.payoutMethod ?? "—"}
                </span>,
                <StatusPill key="s" status={p.status} />,
                fmtDate(p.createdAt),
              ])}
            />
          </Card>
        </section>
      </div>
    </DashboardShell>
  );
}
