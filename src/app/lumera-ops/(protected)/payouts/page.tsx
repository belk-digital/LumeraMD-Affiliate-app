import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { PayoutsClient } from "./PayoutsClient";

export const dynamic = "force-dynamic";

async function getCountStatWithTrend(whereClause: any = {}) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const total = await prisma.affiliatePayout.count({ where: whereClause });
  
  const current30 = await prisma.affiliatePayout.count({
    where: { ...whereClause, createdAt: { gte: thirtyDaysAgo } }
  });
  
  const previous30 = await prisma.affiliatePayout.count({
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

  const totalAgg = await prisma.affiliatePayout.aggregate({
    where: whereClause,
    _sum: { amount: true }
  });
  const total = totalAgg._sum.amount || 0;
  
  const current30Agg = await prisma.affiliatePayout.aggregate({
    where: { ...whereClause, createdAt: { gte: thirtyDaysAgo } },
    _sum: { amount: true }
  });
  const current30 = current30Agg._sum.amount || 0;
  
  const previous30Agg = await prisma.affiliatePayout.aggregate({
    where: { ...whereClause, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    _sum: { amount: true }
  });
  const previous30 = previous30Agg._sum.amount || 0;

  let trend = 0;
  if (previous30 === 0) {
    trend = current30 > 0 ? 100 : 0;
  } else {
    trend = Math.round(((current30 - previous30) / previous30) * 100);
  }

  return { total, trend };
}

async function getAffiliatesPaidStatWithTrend() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const totalRaw = await prisma.affiliatePayout.findMany({
    where: { status: "paid" },
    select: { affiliateId: true },
    distinct: ['affiliateId']
  });
  const total = totalRaw.length;
  
  const current30Raw = await prisma.affiliatePayout.findMany({
    where: { status: "paid", createdAt: { gte: thirtyDaysAgo } },
    select: { affiliateId: true },
    distinct: ['affiliateId']
  });
  const current30 = current30Raw.length;
  
  const previous30Raw = await prisma.affiliatePayout.findMany({
    where: { status: "paid", createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    select: { affiliateId: true },
    distinct: ['affiliateId']
  });
  const previous30 = previous30Raw.length;

  let trend = 0;
  if (previous30 === 0) {
    trend = current30 > 0 ? 100 : 0;
  } else {
    trend = Math.round(((current30 - previous30) / previous30) * 100);
  }

  return { total, trend };
}

export default async function AdminPayoutsPage({
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
  
  const rawMethod = sp.method;
  const method = typeof rawMethod === "string" && rawMethod !== "all" ? rawMethod : undefined;

  const rawDateRange = sp.dateRange;
  const dateRange = typeof rawDateRange === "string" ? rawDateRange : "all";

  const rawPage = sp.page;
  const page = typeof rawPage === "string" ? parseInt(rawPage, 10) || 1 : 1;
  const pageSize = 20;

  // Build dynamic where clause based on filters
  const where: any = {};
  
  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { affiliate: { userEmail: { contains: q, mode: "insensitive" } } },
      { affiliate: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }
  
  if (status) {
    where.status = status;
  }
  
  if (method) {
    where.payoutMethod = method;
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

  // Fetch paginated payouts
  const payoutsPromise = prisma.affiliatePayout.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { affiliate: true },
  });

  // Fetch total count for pagination
  const totalFilteredPromise = prisma.affiliatePayout.count({ where });

  // Fetch summary stats
  const totalPayoutsPromise = getSumStatWithTrend({});
  const pendingPayoutsPromise = getSumStatWithTrend({ status: "pending" });
  const paidPayoutsPromise = getSumStatWithTrend({ status: "paid" });
  const affiliatesPaidPromise = getAffiliatesPaidStatWithTrend();
  
  // Get unique payout methods for filters
  const methodsPromise = prisma.affiliatePayout.findMany({
    select: { payoutMethod: true },
    distinct: ['payoutMethod'],
  });

  // Get affiliates for the manual payout modal dropdown
  const affiliatesPromise = prisma.affiliate.findMany({
    select: { id: true, displayName: true, userEmail: true },
    orderBy: { userEmail: "asc" }
  });

  const [
    payouts, 
    totalFiltered, 
    totalPayouts, 
    pendingPayouts, 
    paidPayouts,
    affiliatesPaid,
    methods,
    allAffiliates
  ] = await Promise.all([
    payoutsPromise,
    totalFilteredPromise,
    totalPayoutsPromise,
    pendingPayoutsPromise,
    paidPayoutsPromise,
    affiliatesPaidPromise,
    methodsPromise,
    affiliatesPromise
  ]);

  const stats = {
    totalPayouts,
    pendingPayouts,
    paidPayouts,
    affiliatesPaid,
  };

  const availableMethods = methods.map(m => m.payoutMethod).filter(Boolean);

  // Real payout period = the date range of the conversions it actually covers.
  const allConversionIds = payouts.flatMap((p) => p.conversionIds);
  const coveredConversions = allConversionIds.length > 0
    ? await prisma.affiliateConversion.findMany({
        where: { id: { in: allConversionIds } },
        select: { id: true, createdAt: true },
      })
    : [];
  const conversionDateById = new Map(coveredConversions.map((c) => [c.id, c.createdAt]));
  const payoutsWithPeriod = payouts.map((p) => {
    const dates = p.conversionIds
      .map((id) => conversionDateById.get(id))
      .filter((d): d is Date => !!d);
    const periodStart = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
    const periodEnd = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
    return { ...p, periodStart, periodEnd };
  });

  return (
    <PayoutsClient
      initialPayouts={payoutsWithPeriod}
      totalFiltered={totalFiltered}
      page={page}
      pageSize={pageSize}
      stats={stats}
      searchQuery={q}
      currentStatus={status || "all"}
      currentMethod={method || "all"}
      currentDateRange={dateRange}
      availableMethods={availableMethods as string[]}
      affiliates={allAffiliates}
    />
  );
}
