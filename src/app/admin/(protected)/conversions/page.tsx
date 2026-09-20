import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { ConversionsClient } from "./ConversionsClient";

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

  return { total, trend };
}

async function getSumStatWithTrend(whereClause: any = {}) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const totalAgg = await prisma.affiliateConversion.aggregate({
    where: whereClause,
    _sum: { commissionAmount: true }
  });
  const total = totalAgg._sum.commissionAmount || 0;
  
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

  return { total, trend };
}

export default async function AdminConversionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdminPage();

  const sp = await searchParams;
  const rawQuery = sp.q;
  const q = (typeof rawQuery === "string" ? rawQuery : "").trim();
  
  const rawStatus = sp.status;
  const status = typeof rawStatus === "string" && rawStatus !== "all" ? rawStatus : undefined;
  
  const rawSource = sp.source;
  const source = typeof rawSource === "string" && rawSource !== "all" ? rawSource : undefined;

  const rawDateRange = sp.dateRange;
  const dateRange = typeof rawDateRange === "string" ? rawDateRange : "all";

  const rawPage = sp.page;
  const page = typeof rawPage === "string" ? parseInt(rawPage, 10) || 1 : 1;
  const pageSize = 20;

  // Build dynamic where clause based on filters
  const where: any = {};
  
  if (q) {
    where.OR = [
      { shopifyOrderName: { contains: q, mode: "insensitive" } },
      { shopifyOrderId: { contains: q, mode: "insensitive" } },
      { affiliate: { userEmail: { contains: q, mode: "insensitive" } } },
      { affiliate: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }
  
  if (status) {
    where.status = status;
  }
  
  if (source) {
    where.attributionSource = source;
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
    include: { affiliate: true },
  });

  // Fetch total count for pagination
  const totalFilteredPromise = prisma.affiliateConversion.count({ where });

  // Fetch summary stats
  const totalOrdersPromise = getCountStatWithTrend({});
  const totalCommissionPromise = getSumStatWithTrend({});
  const pendingCommissionPromise = getSumStatWithTrend({ status: "pending" });
  const paidCommissionPromise = getSumStatWithTrend({ status: "paid" });
  
  // Get unique sources and affiliates for filters (limit for performance)
  const sourcesPromise = prisma.affiliateConversion.findMany({
    select: { attributionSource: true },
    distinct: ['attributionSource'],
  });

  const [
    conversions, 
    totalFiltered, 
    totalOrders, 
    totalCommission, 
    pendingCommission,
    paidCommission,
    sources
  ] = await Promise.all([
    conversionsPromise,
    totalFilteredPromise,
    totalOrdersPromise,
    totalCommissionPromise,
    pendingCommissionPromise,
    paidCommissionPromise,
    sourcesPromise
  ]);

  const stats = {
    totalOrders,
    totalCommission,
    pendingCommission,
    paidCommission,
  };

  const availableSources = sources.map(s => s.attributionSource).filter(Boolean);

  return (
    <ConversionsClient 
      initialConversions={conversions} 
      totalFiltered={totalFiltered}
      page={page}
      pageSize={pageSize}
      stats={stats}
      searchQuery={q}
      currentStatus={status || "all"}
      currentSource={source || "all"}
      currentDateRange={dateRange}
      availableSources={availableSources}
    />
  );
}
