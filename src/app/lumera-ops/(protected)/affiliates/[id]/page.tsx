import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { 
  TabsNav, 
  IdentityInfoCard, 
  AccountStatusCard, 
  QuickActionsCard,
  TeamRecruitingCard,
} from "./AdminAffiliateTabs";
import { MousePointerClick, BarChart as BarChartIcon, DollarSign } from "lucide-react";

import { TabReferral } from "./TabReferral";
import { storeLandingUrl, utmParamsFor } from "@/lib/referral";
import { PLANS, type PlanKey } from "@/lib/membership/plans";
import { authnetConfigured } from "@/lib/authnet/client";
import MembershipCard, { type MembershipSummary } from "./MembershipCard";
import { TabCommission } from "./TabCommission";
import { TabStats } from "./TabStats";
import { TabPayout } from "./TabPayout";
import { TabFraud } from "./TabFraud";

export default async function AdminAffiliateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "identity";

  const affiliate = await prisma.affiliate.findUnique({
    where: { id },
    include: {
      parentAffiliate: true,
      subAffiliates: { include: { subAffiliates: true } },
      clicks: { orderBy: { createdAt: 'desc' } },
      conversions: { orderBy: { createdAt: 'desc' } },
      payouts: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!affiliate) notFound();

  // The affiliate's own membership (a sales rep's Premium, or a customer plan), matched by email.
  const membershipRow = await prisma.customerSignup.findFirst({
    where: { email: { equals: affiliate.userEmail, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  const planInfo = membershipRow ? PLANS[membershipRow.plan as PlanKey] : undefined;
  const membership: MembershipSummary | null = membershipRow
    ? {
        id: membershipRow.id,
        planName: planInfo ? `${planInfo.name}${membershipRow.plan === "agent" ? " (rep)" : ""}` : membershipRow.plan,
        status: membershipRow.status,
        complimentary: membershipRow.complimentary,
        note: membershipRow.complimentaryNote,
        paidThrough: membershipRow.currentPeriodEnd?.toISOString() ?? null,
        billing: membershipRow.authnetSubscriptionId ? "Monthly by card" : "Manual",
        payLink:
          authnetConfigured() &&
          (membershipRow.status === "pending_payment" ||
            membershipRow.status === "past_due" ||
            (membershipRow.status === "paused" &&
              !membershipRow.complimentary &&
              !(membershipRow.currentPeriodEnd && membershipRow.currentPeriodEnd > new Date())))
            ? `${process.env.APP_BASE_URL ?? ""}/pay/${membershipRow.id}`
            : null,
      }
    : null;

  // The address the links are built from: the configured one, else whatever the admin is browsing on.
  const reqHeaders = await headers();
  const host = reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host");
  const baseUrl = (
    process.env.APP_BASE_URL || (host ? `${reqHeaders.get("x-forwarded-proto") ?? "http"}://${host}` : "")
  ).replace(/\/$/, "");

  const settings = await prisma.affiliateSettings.findUnique({ where: { id: "global" } });
  const unilevelEnabled = settings?.unilevelEnabled ?? false;


  const initials = affiliate.displayName
    ? affiliate.displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    : affiliate.userEmail.substring(0, 2).toUpperCase();

  const isApproved = affiliate.status === 'approved';

  return (
    <div className="max-w-6xl space-y-8 p-4 md:p-6 mx-auto w-full">
      <Link
        href="/lumera-ops/affiliates"
        className="text-sm text-primary hover:underline font-medium inline-block mb-2"
      >
        ← All affiliates
      </Link>
      
      {/* Top Header Section */}
      <div className="rounded-2xl border border-line bg-white shadow-sm flex flex-col overflow-hidden mb-6">
        <div className="flex flex-col xl:flex-row">
          {/* Profile Card */}
          <div className="p-6 flex items-center gap-5 xl:w-[45%] shrink-0 xl:border-r border-line border-b xl:border-b-0">
            <div className="w-20 h-20 rounded-full bg-primary-light text-primary flex items-center justify-center font-heading text-2xl font-bold shrink-0">
              {initials}
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-heading text-xl font-bold text-ink truncate">
                  {affiliate.userEmail}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                  isApproved ? 'bg-green-100 text-green-800' :
                  affiliate.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-error/10 text-error'
                }`}>
                  {affiliate.status.charAt(0).toUpperCase() + affiliate.status.slice(1)}
                </span>
              </div>
              <p className="text-sm text-ink/80 font-medium truncate">{affiliate.displayName || "—"}</p>
              <p className="text-xs text-ink/50 mt-1">
                Affiliate since {new Date(affiliate.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 flex-1 divide-y sm:divide-y-0 sm:divide-x divide-line">
            <TopStat 
              label="Total Clicks" 
              value={affiliate.totalClicks} 
              icon={<MousePointerClick className="w-5 h-5" />} 
            />
            <TopStat 
              label="Conversions" 
              value={affiliate.totalConversions} 
              icon={<BarChartIcon className="w-5 h-5" />} 
            />
            <TopStat 
              label="Total Commission" 
              value={`$${affiliate.totalCommissionEarned.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`} 
              icon={<DollarSign className="w-5 h-5" />} 
            />
          </div>
        </div>
        
        {/* Tabs Navigation */}
        <div className="bg-page-bg/30 border-t border-line">
          <TabsNav currentTab={tab} />
        </div>
      </div>

      {tab === "identity" && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="md:col-span-3 h-full">
            <IdentityInfoCard affiliate={affiliate} />
          </div>
          <div className="md:col-span-2 space-y-6">
            <AccountStatusCard affiliate={affiliate} />
            <MembershipCard membership={membership} />
            <TeamRecruitingCard affiliate={affiliate} />
            <QuickActionsCard affiliate={affiliate} />
          </div>
        </div>
      )}

      {tab === "referral" && <TabReferral
          affiliate={affiliate}
          baseUrl={baseUrl}
          landingPage={storeLandingUrl(affiliate.referralSlug)}
          utmParams={new URLSearchParams(utmParamsFor(affiliate.referralSlug)).toString()}
        />}
      {tab === "commission" && (
        <TabCommission affiliate={affiliate} unilevelEnabled={unilevelEnabled} />
      )}
      {tab === "stats" && <TabStats affiliate={affiliate} />}
      {tab === "payout" && <TabPayout affiliate={affiliate} />}
      {tab === "fraud" && <TabFraud affiliate={affiliate} />}
    </div>
  );
}

function TopStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="p-6 flex flex-col justify-center bg-white">
      <div className="bg-primary-light p-2.5 rounded-xl text-primary w-fit mb-3">
        {icon}
      </div>
      <div>
        <div className="font-heading text-2xl font-bold text-ink">{value}</div>
        <div className="text-xs text-ink/50 mt-0.5 font-medium">{label}</div>
      </div>
    </div>
  );
}


