import { prisma } from "@/lib/prisma";
import {
  type RangeDays,
  daysAgo,
  dayKey,
  fmtFull,
  fmtShort,
  pctChange,
  round2,
} from "@/lib/metrics";

const VALID = { notIn: ["voided", "reversed"] as ("voided" | "reversed")[] };

export async function getAdminOverview(days: RangeDays) {
  const start = daysAgo(days);
  const prevStart = daysAgo(days * 2);

  const convWhere = (from: Date, to?: Date) => ({
    createdAt: { gte: from, ...(to ? { lt: to } : {}) },
    status: VALID,
  });
  const convSums = { orderSubtotal: true, orderDiscount: true, commissionAmount: true } as const;

  const [
    affiliateTotal,
    affiliatesNew,
    affiliatesPrev,
    pendingApplications,
    applicationsCur,
    applicationsPrev,
    convCur,
    convPrev,
    owed,
    paidCur,
    paidPrev,
    seriesRows,
    payoutGroups,
    recentApplications,
    topGroups,
  ] = await Promise.all([
    prisma.affiliate.count(),
    prisma.affiliate.count({ where: { createdAt: { gte: start } } }),
    prisma.affiliate.count({ where: { createdAt: { gte: prevStart, lt: start } } }),
    prisma.affiliateApplication.count({ where: { status: "pending" } }),
    prisma.affiliateApplication.count({ where: { createdAt: { gte: start } } }),
    prisma.affiliateApplication.count({ where: { createdAt: { gte: prevStart, lt: start } } }),
    prisma.affiliateConversion.aggregate({
      where: convWhere(start),
      _count: true,
      _sum: convSums,
    }),
    prisma.affiliateConversion.aggregate({
      where: convWhere(prevStart, start),
      _count: true,
      _sum: convSums,
    }),
    prisma.affiliateConversion.aggregate({
      where: { status: { in: ["pending", "approved"] } },
      _sum: { commissionAmount: true },
    }),
    prisma.affiliatePayout.aggregate({
      where: { status: "paid", updatedAt: { gte: start } },
      _sum: { amount: true },
    }),
    prisma.affiliatePayout.aggregate({
      where: { status: "paid", updatedAt: { gte: prevStart, lt: start } },
      _sum: { amount: true },
    }),
    prisma.affiliateConversion.findMany({
      where: convWhere(start),
      select: {
        createdAt: true,
        orderSubtotal: true,
        orderDiscount: true,
        commissionAmount: true,
      },
    }),
    prisma.affiliatePayout.groupBy({
      by: ["status"],
      where: { createdAt: { gte: start }, status: { in: ["pending", "approved", "paid"] } },
      _sum: { amount: true },
    }),
    prisma.affiliateApplication.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.affiliateConversion.groupBy({
      by: ["affiliateId"],
      where: convWhere(start),
      _count: { _all: true },
      _sum: convSums,
    }),
  ]);

  const net = (s: { orderSubtotal: number | null; orderDiscount: number | null }) =>
    (s.orderSubtotal ?? 0) - (s.orderDiscount ?? 0);

  const revenueCur = net(convCur._sum);
  const revenuePrev = net(convPrev._sum);
  const commissionCur = convCur._sum.commissionAmount ?? 0;
  const commissionPrev = convPrev._sum.commissionAmount ?? 0;
  const paidCurAmount = paidCur._sum.amount ?? 0;
  const paidPrevAmount = paidPrev._sum.amount ?? 0;

  const kpis = {
    affiliates: { value: affiliateTotal, change: pctChange(affiliatesNew, affiliatesPrev) },
    pendingApplications: {
      value: pendingApplications,
      change: pctChange(applicationsCur, applicationsPrev),
    },
    conversions: { value: convCur._count, change: pctChange(convCur._count, convPrev._count) },
    revenue: { value: revenueCur, change: pctChange(revenueCur, revenuePrev) },
    commissionOwed: {
      value: owed._sum.commissionAmount ?? 0,
      change: pctChange(commissionCur, commissionPrev),
    },
    paidCommissions: { value: paidCurAmount, change: pctChange(paidCurAmount, paidPrevAmount) },
  };

  // Daily series across the whole range (empty days included so the line is continuous).
  const buckets = new Map<string, { sales: number; conversions: number; commission: number }>();
  const dayList: Date[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    dayList.push(d);
    buckets.set(dayKey(d), { sales: 0, conversions: 0, commission: 0 });
  }
  for (const row of seriesRows) {
    const bucket = buckets.get(dayKey(row.createdAt));
    if (!bucket) continue;
    bucket.sales += row.orderSubtotal - row.orderDiscount;
    bucket.conversions += 1;
    bucket.commission += row.commissionAmount;
  }
  const series = dayList.map((d) => {
    const b = buckets.get(dayKey(d))!;
    return {
      label: fmtShort(d),
      full: fmtFull(d),
      sales: round2(b.sales),
      conversions: b.conversions,
      commission: round2(b.commission),
    };
  });

  const payoutAmount = (status: string) =>
    payoutGroups.find((g) => g.status === status)?._sum.amount ?? 0;
  const payouts = {
    pending: payoutAmount("pending"),
    processing: payoutAmount("approved"),
    paid: payoutAmount("paid"),
  };

  const topSorted = topGroups
    .map((g) => ({
      affiliateId: g.affiliateId,
      conversions: g._count._all,
      revenue: net(g._sum),
      commission: g._sum.commissionAmount ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const topAffiliates = await prisma.affiliate.findMany({
    where: { id: { in: topSorted.map((t) => t.affiliateId) } },
    select: { id: true, displayName: true, userEmail: true },
  });
  const topRows = topSorted.map((t) => {
    const a = topAffiliates.find((x) => x.id === t.affiliateId);
    return { ...t, name: a?.displayName || a?.userEmail || "Unknown", email: a?.userEmail ?? "" };
  });

  return { kpis, series, payouts, recentApplications, topRows };
}
