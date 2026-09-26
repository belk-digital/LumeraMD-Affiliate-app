import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import KpiCard from "@/components/KpiCard";
import PerformanceChart, { type ChartTab } from "@/components/charts/PerformanceChart";
import DonutCard from "@/components/charts/DonutCard";
import { formatMoney } from "@/lib/format";
import { parseRange } from "@/lib/metrics";
import { getAffiliateOverview } from "@/lib/affiliates/dashboardData";
import { requireAffiliateAccess } from "@/lib/affiliates/access";
import DashboardShell from "./DashboardShell";
import CopyableRow from "./CopyableRow";
import { Card } from "./ui";

const TABS: ChartTab[] = [
  { key: "clicks", label: "Clicks", kind: "count", one: "click", other: "clicks" },
  { key: "conversions", label: "Conversions", kind: "count", one: "order", other: "orders" },
  { key: "commission", label: "Commission", kind: "money", one: "commission", other: "commission" },
];

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  await requireAffiliateAccess(id);
  const days = parseRange((await searchParams).range);

  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) notFound();

  const [inFlightAgg, overview] = await Promise.all([
    prisma.affiliatePayout.aggregate({
      where: { affiliateId: id, status: { in: ["pending", "approved"] } },
      _sum: { amount: true },
    }),
    getAffiliateOverview(id, days),
  ]);
  const { kpis, series, sources } = overview;

  const inFlight = inFlightAgg._sum.amount ?? 0;
  const available = Math.max(affiliate.totalCommissionApproved - inFlight, 0);

  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const referralLink = `${appBaseUrl}/ref/${affiliate.referralSlug}`;
  const name = affiliate.displayName || affiliate.userEmail;

  return (
    <DashboardShell
      affiliateId={affiliate.id}
      affiliateEmail={affiliate.userEmail}
      displayName={affiliate.displayName}
      referralLink={referralLink}
      discountCode={affiliate.shopifyDiscountCode}
    >
      <div className="space-y-6 p-4 md:p-6">
        <div className="animate-fade-up">
          <h1 className="font-heading text-2xl font-semibold text-ink">
            Welcome back, {name.split(/[\s@]/)[0]}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Here&apos;s how your referrals are performing.
          </p>
        </div>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            index={0}
            label="Clicks"
            value={kpis.clicks.value}
            icon="cursor"
            change={kpis.clicks.change}
            days={days}
          />
          <KpiCard
            index={1}
            label="Conversions"
            value={kpis.conversions.value}
            icon="chart"
            change={kpis.conversions.change}
            days={days}
          />
          <KpiCard
            index={2}
            label="Commission Earned"
            value={kpis.commission.value}
            format="money"
            icon="dollar"
            change={kpis.commission.change}
            days={days}
          />
          <KpiCard
            index={3}
            label="Avg. Commission"
            value={kpis.avgCommission.value}
            format="money"
            icon="pie"
            change={kpis.avgCommission.change}
            days={days}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <PerformanceChart title="Performance" series={series} tabs={TABS} days={days} />
          </div>
          <div className="min-w-0">
            <DonutCard
              title="Payout Overview"
              totalLabel="Total Earned"
              index={3}
              slices={[
                {
                  key: "pending",
                  label: "Pending",
                  value: affiliate.totalCommissionPending,
                  color: "#f5a524",
                },
                {
                  key: "approved",
                  label: "Approved",
                  value: affiliate.totalCommissionApproved,
                  color: "#5fd0ff",
                },
                {
                  key: "paid",
                  label: "Paid",
                  value: affiliate.totalCommissionPaid,
                  color: "#4ade80",
                },
              ]}
              footer={
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-white/70">Available to request</div>
                    <div className="font-heading text-xl font-semibold">
                      {formatMoney(available)}
                    </div>
                  </div>
                  <a
                    href={`/affiliates/dashboard/${affiliate.id}/payouts`}
                    className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-primary transition hover:bg-white/90"
                  >
                    Request payout
                  </a>
                </div>
              }
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card title="Your links" delay={120} className="min-w-0 xl:col-span-2">
            <div className="flex flex-col gap-6 sm:flex-row">
              <div className="flex-1 min-w-0 space-y-3 text-sm">
                <CopyableRow label="Order link" value={referralLink} />
                {affiliate.shopifyDiscountCode && (
                  <CopyableRow label="Discount code" value={affiliate.shopifyDiscountCode} mono />
                )}
                <p className="pt-1 text-xs text-ink/45">
                  Orders placed through your link or code are credited to you automatically.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 sm:border-l sm:border-line sm:pl-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/affiliates/${affiliate.id}/qr`}
                  alt="Order link QR code"
                  className="h-32 w-32 rounded-xl border border-line"
                />
                <a
                  href={`/api/affiliates/${affiliate.id}/qr?download=1`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Download QR
                </a>
              </div>
            </div>
          </Card>

          <div className="min-w-0">
            <DonutCard
              title="How orders arrive"
              totalLabel="Orders"
              format="int"
              variant="white"
              index={5}
              slices={[
                { key: "link", label: "Order link", value: sources.referral_link, color: "#4f46e5" },
                { key: "coupon", label: "Coupon code", value: sources.coupon_code, color: "#e59a35" },
                { key: "both", label: "Both", value: sources.both, color: "#5aa0f0" },
              ]}
            />
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
