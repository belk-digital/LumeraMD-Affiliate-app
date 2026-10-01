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

/** Everything the affiliate's overview page needs for a date range, computed from real rows. */
export async function getAffiliateOverview(affiliateId: string, days: RangeDays) {
  const start = daysAgo(days);
  const prevStart = daysAgo(days * 2);

  const convWhere = (from: Date, to?: Date) => ({
    affiliateId,
    createdAt: { gte: from, ...(to ? { lt: to } : {}) },
    status: VALID,
  });

  const teamWhere = (from: Date, to?: Date) => ({
    parentAffiliateId: affiliateId,
    createdAt: { gte: from, ...(to ? { lt: to } : {}) },
    status: VALID,
  });

  const overrideWhere = (from: Date, to?: Date) => ({
    affiliateId,
    createdAt: { gte: from, ...(to ? { lt: to } : {}) },
    conversion: { status: VALID },
  });

  const [clicksCur, clicksPrev, clickRows, convRows, convPrev, legacyTeamRows, legacyTeamPrev, slotRows, slotPrev] =
    await Promise.all([
    prisma.affiliateClick.count({ where: { affiliateId, createdAt: { gte: start } } }),
    prisma.affiliateClick.count({
      where: { affiliateId, createdAt: { gte: prevStart, lt: start } },
    }),
    prisma.affiliateClick.findMany({
      where: { affiliateId, createdAt: { gte: start } },
      select: { createdAt: true },
    }),
    prisma.affiliateConversion.findMany({
      where: convWhere(start),
      select: { createdAt: true, commissionAmount: true, attributionSource: true },
    }),
    prisma.affiliateConversion.aggregate({
      where: convWhere(prevStart, start),
      _count: true,
      _sum: { commissionAmount: true },
    }),
    prisma.affiliateConversion.findMany({
      where: teamWhere(start),
      select: { createdAt: true, parentCommissionAmount: true },
    }),
    prisma.affiliateConversion.aggregate({
      where: teamWhere(prevStart, start),
      _sum: { parentCommissionAmount: true },
    }),
    prisma.conversionOverride.findMany({
      where: overrideWhere(start),
      select: { createdAt: true, amount: true },
    }),
    prisma.conversionOverride.aggregate({
      where: overrideWhere(prevStart, start),
      _sum: { amount: true },
    }),
  ]);

  // Team earnings: legacy single-parent overrides plus unilevel override slots.
  const teamRows = [
    ...legacyTeamRows.map((c) => ({ createdAt: c.createdAt, amount: c.parentCommissionAmount ?? 0 })),
    ...slotRows,
  ];
  const teamPrevSum = (legacyTeamPrev._sum.parentCommissionAmount ?? 0) + (slotPrev._sum.amount ?? 0);

  // Earnings = own commission + team override (both are payable from the same balance). The
  // average stays per-own-order so it isn't skewed by override income.
  const ownCur = convRows.reduce((acc, c) => acc + c.commissionAmount, 0);
  const ownPrev = convPrev._sum.commissionAmount ?? 0;
  const teamCur = teamRows.reduce((acc, c) => acc + c.amount, 0);
  const commissionCur = ownCur + teamCur;
  const commissionPrev = ownPrev + teamPrevSum;
  const avgCur = convRows.length > 0 ? ownCur / convRows.length : 0;
  const avgPrev = convPrev._count > 0 ? ownPrev / convPrev._count : 0;

  const kpis = {
    clicks: { value: clicksCur, change: pctChange(clicksCur, clicksPrev) },
    conversions: {
      value: convRows.length,
      change: pctChange(convRows.length, convPrev._count),
    },
    commission: { value: round2(commissionCur), change: pctChange(commissionCur, commissionPrev) },
    avgCommission: { value: round2(avgCur), change: pctChange(avgCur, avgPrev) },
  };

  const buckets = new Map<string, { clicks: number; conversions: number; commission: number }>();
  const dayList: Date[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    dayList.push(d);
    buckets.set(dayKey(d), { clicks: 0, conversions: 0, commission: 0 });
  }
  for (const c of clickRows) {
    const b = buckets.get(dayKey(c.createdAt));
    if (b) b.clicks += 1;
  }
  for (const c of convRows) {
    const b = buckets.get(dayKey(c.createdAt));
    if (!b) continue;
    b.conversions += 1;
    b.commission += c.commissionAmount;
  }
  for (const c of teamRows) {
    const b = buckets.get(dayKey(c.createdAt));
    if (b) b.commission += c.amount;
  }
  const series = dayList.map((d) => {
    const b = buckets.get(dayKey(d))!;
    return {
      label: fmtShort(d),
      full: fmtFull(d),
      clicks: b.clicks,
      conversions: b.conversions,
      commission: round2(b.commission),
    };
  });

  const sources = { referral_link: 0, coupon_code: 0, both: 0 };
  for (const c of convRows) sources[c.attributionSource] += 1;

  return { kpis, series, sources };
}

/**
 * Recruits and what they earn you.
 *
 * Privacy rule (same as the original 99pp program): the parent sees what each direct recruit
 * earned THEM (the override) plus the recruit's own stats, and can see who is on the recruit's
 * team by name and stats — but never what the recruit earns from those people. That money is the
 * recruit's, the same way the parent's override is hidden from their own recruits. Nothing here is
 * ever exposed to a recruit about their parent.
 */
export async function getTeamOverview(affiliateId: string) {
  const days = 30;
  const start = daysAgo(days);
  const prevStart = daysAgo(days * 2);

  const members = await prisma.affiliate.findMany({
    where: { parentAffiliateId: affiliateId },
    orderBy: { createdAt: "desc" },
    include: {
      subAffiliates: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          displayName: true,
          userEmail: true,
          status: true,
          createdAt: true,
          totalConversions: true,
          totalCommissionEarned: true,
        },
      },
    },
  });
  const memberIds = members.map((m) => m.id);
  const secondLevel = members.flatMap((m) => m.subAffiliates);

  const inWindow = (d: Date, from: Date, to?: Date) => d >= from && (!to || d < to);

  const [legacyRows, slotRows] = await Promise.all([
    prisma.affiliateConversion.findMany({
      where: { parentAffiliateId: affiliateId, status: VALID },
      select: { affiliateId: true, createdAt: true, parentCommissionAmount: true },
    }),
    prisma.conversionOverride.findMany({
      where: { affiliateId, conversion: { status: VALID } },
      select: { createdAt: true, amount: true, level: true, conversion: { select: { affiliateId: true } } },
    }),
  ]);
  // Per-recruit attribution only covers direct recruits' own sales (level 1). Deeper unilevel
  // earnings still count toward the totals below, they just aren't broken out by member.
  const overrideRows = [
    ...legacyRows.map((r) => ({ sellerId: r.affiliateId as string | null, createdAt: r.createdAt, amount: r.parentCommissionAmount ?? 0 })),
    ...slotRows.map((r) => ({
      sellerId: r.level === 1 ? r.conversion.affiliateId : null,
      createdAt: r.createdAt,
      amount: r.amount,
    })),
  ];
  const earnedFrom = new Map<string, number>();
  let earnedTotal = 0;
  let earnedCur = 0;
  let earnedPrev = 0;
  for (const r of overrideRows) {
    const amt = r.amount;
    if (r.sellerId) earnedFrom.set(r.sellerId, (earnedFrom.get(r.sellerId) ?? 0) + amt);
    earnedTotal += amt;
    if (inWindow(r.createdAt, start)) earnedCur += amt;
    else if (inWindow(r.createdAt, prevStart, start)) earnedPrev += amt;
  }

  const [convCur, convPrev] = await Promise.all([
    prisma.affiliateConversion.count({
      where: { affiliateId: { in: memberIds }, createdAt: { gte: start }, status: VALID },
    }),
    prisma.affiliateConversion.count({
      where: {
        affiliateId: { in: memberIds },
        createdAt: { gte: prevStart, lt: start },
        status: VALID,
      },
    }),
  ]);

  const joinedCur = members.filter((m) => inWindow(m.createdAt, start)).length;
  const joinedPrev = members.filter((m) => inWindow(m.createdAt, prevStart, start)).length;
  const secondCur = secondLevel.filter((m) => inWindow(m.createdAt, start)).length;
  const secondPrev = secondLevel.filter((m) => inWindow(m.createdAt, prevStart, start)).length;

  return {
    days,
    members: members
      .map((m) => ({ ...m, earnedFromThem: round2(earnedFrom.get(m.id) ?? 0) }))
      .sort((a, b) => b.earnedFromThem - a.earnedFromThem),
    kpis: {
      members: { value: members.length, change: pctChange(joinedCur, joinedPrev) },
      conversions: {
        value: members.reduce((acc, m) => acc + m.totalConversions, 0),
        change: pctChange(convCur, convPrev),
      },
      earnings: { value: round2(earnedTotal), change: pctChange(earnedCur, earnedPrev) },
      secondLevel: { value: secondLevel.length, change: pctChange(secondCur, secondPrev) },
    },
  };
}
