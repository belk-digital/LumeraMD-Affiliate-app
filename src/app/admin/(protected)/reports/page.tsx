import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/requireAdmin";
import { ReportsClient } from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdminPage();

  const sp = await searchParams;
  
  const rawDateRange = sp.dateRange;
  const dateRange = typeof rawDateRange === "string" ? rawDateRange : "last30";
  
  const rawAffiliateId = sp.affiliateId;
  const affiliateId = typeof rawAffiliateId === "string" && rawAffiliateId !== "all" ? rawAffiliateId : undefined;

  const now = new Date();
  let startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  
  if (dateRange === "last7") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  } else if (dateRange === "thisMonth") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  } else if (dateRange === "all") {
    startDate = new Date("2020-01-01");
    previousStartDate = new Date("2010-01-01"); // irrelevant
  }

  // Build where clauses
  const convWhere: any = { createdAt: { gte: previousStartDate } };
  const clickWhere: any = { createdAt: { gte: previousStartDate } };
  
  if (affiliateId) {
    convWhere.affiliateId = affiliateId;
    clickWhere.affiliateId = affiliateId;
  }

  // Fetch data
  const [conversionsRaw, clicksRaw, affiliatesRaw] = await Promise.all([
    prisma.affiliateConversion.findMany({
      where: convWhere,
      select: { 
        createdAt: true, 
        commissionAmount: true, 
        eligibleSubtotal: true, 
        affiliateId: true,
        affiliate: { select: { userEmail: true, displayName: true } }
      }
    }),
    prisma.affiliateClick.findMany({
      where: clickWhere,
      select: { createdAt: true, affiliateId: true }
    }),
    prisma.affiliate.findMany({
      where: { status: "approved" },
      select: { id: true, displayName: true, userEmail: true },
      orderBy: { userEmail: "asc" }
    })
  ]);

  // Aggregate stats
  const currentPeriodConvs = conversionsRaw.filter(c => c.createdAt >= startDate);
  const previousPeriodConvs = conversionsRaw.filter(c => c.createdAt >= previousStartDate && c.createdAt < startDate);
  
  const currentPeriodClicks = clicksRaw.filter(c => c.createdAt >= startDate);
  const previousPeriodClicks = clicksRaw.filter(c => c.createdAt >= previousStartDate && c.createdAt < startDate);

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const totalOrders = currentPeriodConvs.length;
  const totalOrdersTrend = calculateTrend(totalOrders, previousPeriodConvs.length);

  const totalRevenue = currentPeriodConvs.reduce((sum, c) => sum + c.eligibleSubtotal, 0);
  const totalRevenueTrend = calculateTrend(
    totalRevenue, 
    previousPeriodConvs.reduce((sum, c) => sum + c.eligibleSubtotal, 0)
  );

  const totalCommission = currentPeriodConvs.reduce((sum, c) => sum + c.commissionAmount, 0);
  const totalCommissionTrend = calculateTrend(
    totalCommission, 
    previousPeriodConvs.reduce((sum, c) => sum + c.commissionAmount, 0)
  );

  const totalClicks = currentPeriodClicks.length;
  const totalClicksTrend = calculateTrend(totalClicks, previousPeriodClicks.length);

  const stats = {
    totalOrders: { total: totalOrders, trend: totalOrdersTrend },
    totalRevenue: { total: totalRevenue, trend: totalRevenueTrend },
    totalCommission: { total: totalCommission, trend: totalCommissionTrend },
    totalClicks: { total: totalClicks, trend: totalClicksTrend },
  };

  // Build daily breakdown
  const dailyDataMap = new Map<string, any>();
  
  // Initialize map with empty days for the current period
  if (dateRange !== "all") {
    let d = new Date(startDate);
    while (d <= now) {
      const dateStr = d.toISOString().split('T')[0];
      dailyDataMap.set(dateStr, {
        dateStr,
        displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        shortDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        orders: 0,
        revenue: 0,
        commission: 0,
        clicks: 0,
        conversions: 0,
        affiliateRevenues: {} // Track revenue per affiliate to find the top one
      });
      d.setDate(d.getDate() + 1);
    }
  }

  // Populate clicks
  for (const c of currentPeriodClicks) {
    const dateStr = c.createdAt.toISOString().split('T')[0];
    if (!dailyDataMap.has(dateStr)) {
      dailyDataMap.set(dateStr, {
        dateStr,
        displayDate: c.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        shortDate: c.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        orders: 0, revenue: 0, commission: 0, clicks: 0, conversions: 0, affiliateRevenues: {}
      });
    }
    dailyDataMap.get(dateStr)!.clicks++;
  }

  // Populate conversions
  for (const c of currentPeriodConvs) {
    const dateStr = c.createdAt.toISOString().split('T')[0];
    if (!dailyDataMap.has(dateStr)) {
      dailyDataMap.set(dateStr, {
        dateStr,
        displayDate: c.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        shortDate: c.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        orders: 0, revenue: 0, commission: 0, clicks: 0, conversions: 0, affiliateRevenues: {}
      });
    }
    
    const day = dailyDataMap.get(dateStr)!;
    day.orders++;
    day.conversions++;
    day.revenue += c.eligibleSubtotal;
    day.commission += c.commissionAmount;

    if (!day.affiliateRevenues[c.affiliateId]) {
      day.affiliateRevenues[c.affiliateId] = {
        amount: 0,
        name: c.affiliate?.displayName || c.affiliate?.userEmail || "Unknown",
        email: c.affiliate?.userEmail || "Unknown"
      };
    }
    day.affiliateRevenues[c.affiliateId].amount += c.eligibleSubtotal;
  }

  // Calculate top affiliate per day and flatten
  let dailyData = Array.from(dailyDataMap.values()).map(day => {
    let topAffiliate = null;
    let maxRev = -1;
    for (const [id, data] of Object.entries(day.affiliateRevenues)) {
      const typedData = data as { amount: number, name: string, email: string };
      if (typedData.amount > maxRev) {
        maxRev = typedData.amount;
        topAffiliate = { id, name: typedData.name, email: typedData.email };
      }
    }
    
    return {
      ...day,
      topAffiliate,
      // Remove the raw map to save payload size
      affiliateRevenues: undefined
    };
  });

  // Sort chronologically for charts
  dailyData.sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime());

  return (
    <ReportsClient 
      dailyData={dailyData}
      stats={stats}
      currentDateRange={dateRange}
      currentAffiliateId={affiliateId || "all"}
      affiliates={affiliatesRaw}
    />
  );
}
