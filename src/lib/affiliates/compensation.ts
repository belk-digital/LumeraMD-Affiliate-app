import { prisma } from "@/lib/prisma";
import { sellerTierFor } from "@/lib/commission/plan";
import {
  activeRecruitCount,
  monthWindow,
  personalSales,
  planFromSettings,
} from "@/lib/affiliates/unilevel";
import { round2 } from "@/lib/metrics";

const VALID = { notIn: ["voided", "reversed"] as ("voided" | "reversed")[] };
const MAX_LEVELS = 20; // how deep to count the downline; also a guard against cyclic data

/**
 * Everything the affiliate's Compensation page shows, computed with the same plan, window and
 * qualification rules the commission engine uses, so what a rep sees can't drift from what they're
 * paid.
 */
export async function getCompensationOverview(affiliateId: string, now = new Date()) {
  const [affiliate, settings] = await Promise.all([
    prisma.affiliate.findUniqueOrThrow({ where: { id: affiliateId } }),
    prisma.affiliateSettings.upsert({ where: { id: "global" }, update: {}, create: { id: "global" } }),
  ]);
  const plan = planFromSettings(settings);
  const window = monthWindow(now);

  const [sales, activeRecruits, directRecruits, slotRows, lifetime, recent] = await Promise.all([
    personalSales(affiliateId, window),
    activeRecruitCount(affiliateId, plan, window),
    prisma.affiliate.count({ where: { parentAffiliateId: affiliateId, status: "approved" } }),
    prisma.conversionOverride.findMany({
      where: {
        affiliateId,
        createdAt: { gte: window.start, lt: window.end },
        conversion: { status: VALID },
      },
      select: { slot: true, amount: true },
    }),
    prisma.conversionOverride.aggregate({
      where: { affiliateId, conversion: { status: VALID } },
      _sum: { amount: true },
    }),
    prisma.conversionOverride.findMany({
      where: { affiliateId, conversion: { status: VALID } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, createdAt: true, level: true, slot: true, rate: true, amount: true },
    }),
  ]);

  // Seller tier and progress to the next one, from this month's sales.
  const tier = sellerTierFor(sales, plan);
  const tierIndex = plan.sellerTiers.findIndex((t) => t.name === tier.name);
  const nextTier = plan.sellerTiers[tierIndex + 1] ?? null;

  // Qualification for overrides: both requirements, every month.
  const meetsRecruits = activeRecruits >= plan.requiredActiveRecruits;
  const meetsSales = sales >= plan.minPersonalSales;

  // This month's override earnings by paid slot.
  const slots = plan.overrideSlotRates.map((rate, i) => {
    const rows = slotRows.filter((r) => r.slot === i + 1);
    return {
      slot: i + 1,
      rate,
      sales: rows.length,
      earned: round2(rows.reduce((acc, r) => acc + r.amount, 0)),
    };
  });

  // Everyone below this affiliate, level by level (direct recruits are level 1).
  const levels: number[] = [];
  const seen = new Set<string>([affiliateId]);
  let frontier = [affiliateId];
  for (let level = 1; level <= MAX_LEVELS && frontier.length > 0; level++) {
    const children = await prisma.affiliate.findMany({
      where: { parentAffiliateId: { in: frontier }, status: "approved" },
      select: { id: true },
    });
    frontier = children.map((c) => c.id).filter((id) => !seen.has(id));
    frontier.forEach((id) => seen.add(id));
    if (frontier.length > 0) levels.push(frontier.length);
  }

  return {
    enabled: settings.unilevelEnabled,
    flatRate: affiliate.commissionRate,
    monthLabel: now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    sales: round2(sales),
    tiers: plan.sellerTiers,
    tier,
    nextTier,
    toNextTier: nextTier ? Math.max(round2(nextTier.minMonthlySales - sales), 0) : 0,
    tierProgress: nextTier
      ? Math.min(
          Math.max(
            (sales - tier.minMonthlySales) / (nextTier.minMonthlySales - tier.minMonthlySales),
            0,
          ),
          1,
        )
      : 1,
    qualification: {
      qualified: meetsRecruits && meetsSales,
      activeRecruits,
      requiredRecruits: plan.requiredActiveRecruits,
      directRecruits,
      meetsRecruits,
      minPersonalSales: plan.minPersonalSales,
      meetsSales,
      activeRecruitMinSales: plan.activeRecruitMinSales,
    },
    slots,
    overrideEarnedThisMonth: round2(slots.reduce((acc, s) => acc + s.earned, 0)),
    overrideEarnedLifetime: round2(lifetime._sum.amount ?? 0),
    recent,
    levels,
    teamSize: levels.reduce((acc, n) => acc + n, 0),
  };
}

export type CompensationOverview = Awaited<ReturnType<typeof getCompensationOverview>>;
