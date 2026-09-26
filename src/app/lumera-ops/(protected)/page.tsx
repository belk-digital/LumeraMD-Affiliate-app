import Link from "next/link";
import Icon from "@/components/Icon";
import KpiCard from "@/components/KpiCard";
import PerformanceChart, { type ChartTab } from "@/components/charts/PerformanceChart";
import DonutCard from "@/components/charts/DonutCard";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { getAdminOverview } from "@/lib/admin/overview";
import { parseRange } from "@/lib/metrics";
import ApplicationsTable from "./_components/ApplicationsTable";
import TopAffiliates from "./_components/TopAffiliates";

const TABS: ChartTab[] = [
  { key: "sales", label: "Sales", kind: "money", one: "sale", other: "sales" },
  { key: "conversions", label: "Conversions", kind: "count", one: "conversion", other: "conversions" },
  { key: "commission", label: "Commission", kind: "money", one: "commission", other: "commission" },
];

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdminPage();

  const days = parseRange((await searchParams).range);
  const { kpis, series, payouts, recentApplications, topRows } = await getAdminOverview(days);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-ink">Overview</h1>
        <p className="mt-1.5 text-sm text-ink/60 font-medium">
          Program performance at a glance — affiliates, conversions, and payouts.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          index={0}
          label="Total Affiliates"
          value={kpis.affiliates.value}
          icon="users"
          change={kpis.affiliates.change}
          days={days}
          href="/lumera-ops/affiliates"
        />
        <KpiCard
          index={1}
          label="Pending Applications"
          value={kpis.pendingApplications.value}
          icon="document"
          change={kpis.pendingApplications.change}
          days={days}
          href="/lumera-ops/applications?status=pending"
        />
        <KpiCard
          index={2}
          label="Total Conversions"
          value={kpis.conversions.value}
          icon="chart"
          change={kpis.conversions.change}
          days={days}
          href="/lumera-ops/conversions"
        />
        <KpiCard
          index={3}
          label="Total Revenue"
          value={kpis.revenue.value}
          format="money"
          icon="dollar"
          change={kpis.revenue.change}
          days={days}
          href="/lumera-ops/conversions"
        />
        <KpiCard
          index={4}
          label="Commission Owed"
          value={kpis.commissionOwed.value}
          format="money"
          icon="pie"
          change={kpis.commissionOwed.change}
          days={days}
          href="/lumera-ops/conversions"
          inverse
        />
        <KpiCard
          index={5}
          label="Paid Commissions"
          value={kpis.paidCommissions.value}
          format="money"
          icon="card"
          change={kpis.paidCommissions.change}
          days={days}
          href="/lumera-ops/payouts"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <PerformanceChart title="Affiliate Performance" series={series} tabs={TABS} days={days} />
        </div>
        <div className="min-w-0">
          <DonutCard
            title="Payout Overview"
            totalLabel="Total Payouts"
            href="/lumera-ops/payouts"
            slices={[
              { key: "pending", label: "Pending", value: payouts.pending, color: "#f5a524" },
              { key: "processing", label: "Processing", value: payouts.processing, color: "#5fd0ff" },
              { key: "paid", label: "Paid", value: payouts.paid, color: "#4ade80" },
            ]}
            index={3}
          />
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.6fr_1fr]">
        <div
          className="animate-fade-up min-w-0 rounded-2xl border border-line bg-white p-5 shadow-sm"
          style={{ "--delay": "200ms" } as React.CSSProperties}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-ink">Recent Applications</h2>
            <Link
              href="/lumera-ops/applications"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View all <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
          <ApplicationsTable
            applications={recentApplications}
            emptyMessage="No applications yet."
          />
        </div>

        <div className="min-w-0">
          <TopAffiliates rows={topRows} />
        </div>
      </section>
    </div>
  );
}
