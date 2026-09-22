import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAffiliateAccess } from "@/lib/affiliates/access";
import DashboardShell from "../DashboardShell";
import { AffiliateConversionsClient } from "./AffiliateConversionsClient";

export const dynamic = "force-dynamic";

async function getCountStatWithTrend(whereClause: any = {}) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const total = await prisma.affiliateConversion.count({ where: whereClause });
  
  const current30 = await prisma.affiliateConversion.count({
    where: { ...whereClause, createdAt: { gte: thirtyDaysAgo } }
  });
  
  const previous30 = await prisma.affiliateConversion.count({
    where: { ...whereClause, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }
  });

  let trend = 0;
  if (previous30 === 0) {
    trend = current30 > 0 ? 100 : 0;
  } else {
    trend = Math.round(((current30 - previous30) / previous30) * 100);
  }

  return { total, trend, count: total };
}

async function getSumStatWithTrend(whereClause: any = {}) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const totalAgg = await prisma.affiliateConversion.aggregate({
    where: whereClause,
    _sum: { commissionAmount: true },
    _count: { id: true }
  });
  const total = totalAgg._sum.commissionAmount || 0;
  const count = totalAgg._count.id || 0;
  
  const current30Agg = await prisma.affiliateConversion.aggregate({
    where: { ...whereClause, createdAt: { gte: thirtyDaysAgo } },
    _sum: { commissionAmount: true }
  });
  const current30 = current30Agg._sum.commissionAmount || 0;
  
  const previous30Agg = await prisma.affiliateConversion.aggregate({
    where: { ...whereClause, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    _sum: { commissionAmount: true }
  });
  const previous30 = previous30Agg._sum.commissionAmount || 0;

  let trend = 0;
  if (previous30 === 0) {
    trend = current30 > 0 ? 100 : 0;
  } else {
    trend = Math.round(((current30 - previous30) / previous30) * 100);
  }

  return { total, trend, count };
}

export default async function ConversionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  await requireAffiliateAccess(id);

  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) notFound();

  const sp = await searchParams;
  const rawQuery = sp.q;
  const q = (typeof rawQuery === "string" ? rawQuery : "").trim();
  
  const rawStatus = sp.status;
  const status = typeof rawStatus === "string" && rawStatus !== "all" ? rawStatus : undefined;

  const rawDateRange = sp.dateRange;
  const dateRange = typeof rawDateRange === "string" ? rawDateRange : "last30";

  const rawPage = sp.page;
  const page = typeof rawPage === "string" ? parseInt(rawPage, 10) || 1 : 1;
  const pageSize = 20;

  // Build dynamic where clause for this specific affiliate
  const where: any = { affiliateId: id };

  if (q) {
    where.OR = [
      { shopifyOrderName: { contains: q, mode: "insensitive" } },
      { shopifyOrderId: { contains: q, mode: "insensitive" } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (dateRange !== "all") {
    const now = new Date();
    if (dateRange === "last7") {
      where.createdAt = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    } else if (dateRange === "last30") {
      where.createdAt = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    } else if (dateRange === "thisMonth") {
      where.createdAt = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    }
  }

  // Fetch paginated conversions
  const conversionsPromise = prisma.affiliateConversion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Fetch total count for pagination
  const totalFilteredPromise = prisma.affiliateConversion.count({ where });

  // Fetch summary stats
  const totalOrdersPromise = getCountStatWithTrend({ affiliateId: id });
  const totalCommissionPromise = getSumStatWithTrend({ affiliateId: id });
  const pendingCommissionPromise = getSumStatWithTrend({ affiliateId: id, status: "pending" });
  const paidCommissionPromise = getSumStatWithTrend({ affiliateId: id, status: "paid" });

  const [
    conversions, 
    totalFiltered, 
    totalOrders, 
    totalCommission, 
    pendingCommission,
    paidCommission
  ] = await Promise.all([
    conversionsPromise,
    totalFilteredPromise,
    totalOrdersPromise,
    totalCommissionPromise,
    pendingCommissionPromise,
    paidCommissionPromise
  ]);

  const stats = {
    totalOrders,
    totalCommission,
    pendingCommission,
    paidCommission,
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
      <AffiliateConversionsClient 
        affiliateId={affiliate.id}
        referralLink={referralLink}
        discountCode={affiliate.shopifyDiscountCode}
        initialConversions={conversions}
        totalFiltered={totalFiltered}
        page={page}
        pageSize={pageSize}
        stats={stats}
        searchQuery={q}
        currentStatus={status || "all"}
        currentDateRange={dateRange}
      />
    </DashboardShell>
  );
}
