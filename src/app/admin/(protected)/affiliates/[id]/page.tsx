import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import OverrideRateForm from "./OverrideRateForm";

export default async function AdminAffiliateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;

  const affiliate = await prisma.affiliate.findUnique({
    where: { id },
    include: {
      parentAffiliate: true,
      subAffiliates: { include: { subAffiliates: true } },
    },
  });
  if (!affiliate) notFound();

  const settings = await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });

  return (
    <div className="max-w-3xl space-y-8 p-4 md:p-6">
      <div>
        <Link
          href="/admin/affiliates"
          className="text-sm text-ink/50 hover:text-ink"
        >
          ← All affiliates
        </Link>
        <h1 className="font-heading text-2xl font-semibold text-ink mt-2">
          {affiliate.userEmail}
        </h1>
        <p className="text-sm text-ink/60 capitalize">{affiliate.status}</p>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Clicks" value={affiliate.totalClicks} />
        <Stat label="Conversions" value={affiliate.totalConversions} />
        <Stat
          label="Pending"
          value={`$${affiliate.totalCommissionPending.toFixed(2)}`}
        />
        <Stat
          label="Paid"
          value={`$${affiliate.totalCommissionPaid.toFixed(2)}`}
        />
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 space-y-2 text-sm">
        <Row label="Referral slug" value={affiliate.referralSlug} />
        <Row label="Discount code" value={affiliate.shopifyDiscountCode ?? "—"} />
        <Row
          label="Commission"
          value={`${affiliate.commissionRate}${affiliate.commissionType === "percent" ? "%" : " USD"}`}
        />
        <Row
          label="Parent affiliate"
          value={
            affiliate.parentAffiliate ? (
              <Link
                href={`/admin/affiliates/${affiliate.parentAffiliate.id}`}
                className="text-primary hover:underline"
              >
                {affiliate.parentAffiliate.userEmail}
              </Link>
            ) : (
              "—"
            )
          }
        />
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-heading text-base font-semibold text-ink">Team override</h2>
        <OverrideRateForm
          key={String(affiliate.parentOverrideRate)}
          affiliateId={affiliate.id}
          initialRate={affiliate.parentOverrideRate}
          defaultRate={settings.defaultParentOverrideRate}
        />
      </section>

      <section>
        <h2 className="font-heading text-base font-semibold text-ink mb-3">
          Team ({affiliate.subAffiliates.length} direct
          {affiliate.subAffiliates.length === 1 ? "" : "s"})
        </h2>
        {affiliate.subAffiliates.length === 0 ? (
          <p className="text-sm text-ink/40">No sub-affiliates recruited.</p>
        ) : (
          <div className="rounded-2xl border border-line bg-white divide-y divide-line">
            {affiliate.subAffiliates.map((sub) => (
              <Link
                key={sub.id}
                href={`/admin/affiliates/${sub.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-page-bg"
              >
                <span>{sub.userEmail}</span>
                <span className="text-ink/50">
                  {sub.subAffiliates.length} sub-affiliate
                  {sub.subAffiliates.length === 1 ? "" : "s"} · $
                  {sub.totalCommissionEarned.toFixed(2)} earned
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-xs text-ink/50">{label}</div>
      <div className="mt-1 font-heading text-xl font-semibold text-ink">
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-ink/50">{label}</span>
      <span>{value}</span>
    </div>
  );
}
