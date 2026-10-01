import { prisma } from "@/lib/prisma";
import type { AffiliateSettings, Affiliate } from "@/generated/prisma/client";
import {
  DEFAULT_PLAN,
  calculateCommission,
  isQualified,
  type CommissionResult,
  type CompPlan,
  type SellerTier,
  type UplineInput,
} from "@/lib/commission/plan";

const MAX_GENEALOGY_DEPTH = 50; // guard against runaway/cyclic chains
const COUNTED = ["pending", "approved", "paid"] as const;

/** Builds the compensation plan from the global settings row, falling back to the defaults. */
export function planFromSettings(settings: AffiliateSettings): CompPlan {
  const tiers = Array.isArray(settings.unilevelSellerTiers)
    ? (settings.unilevelSellerTiers as unknown as SellerTier[])
        .filter(
          (t) =>
            t &&
            typeof t.name === "string" &&
            Number.isFinite(t.minMonthlySales) &&
            Number.isFinite(t.rate),
        )
        .sort((a, b) => a.minMonthlySales - b.minMonthlySales)
    : [];
  return {
    sellerTiers: tiers.length > 0 ? tiers : DEFAULT_PLAN.sellerTiers,
    overrideSlotRates:
      settings.unilevelSlotRates.length > 0 ? settings.unilevelSlotRates : DEFAULT_PLAN.overrideSlotRates,
    requiredActiveRecruits: settings.unilevelRequiredRecruits,
    minPersonalSales: settings.unilevelMinPersonalSales,
    activeRecruitMinSales: settings.unilevelActiveRecruitMinSales,
  };
}

/** Calendar month (UTC) containing `at`. Qualification is judged per calendar month. */
export function monthWindow(at: Date) {
  return {
    start: new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)),
    end: new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1)),
  };
}

type Window = ReturnType<typeof monthWindow>;

/** An affiliate's own sales volume in the window (eligible subtotal of live conversions). */
export async function personalSales(affiliateId: string, window: Window): Promise<number> {
  const agg = await prisma.affiliateConversion.aggregate({
    where: {
      affiliateId,
      status: { in: [...COUNTED] },
      createdAt: { gte: window.start, lt: window.end },
    },
    _sum: { eligibleSubtotal: true },
  });
  return agg._sum.eligibleSubtotal ?? 0;
}

/** Recruits that count as "active" this month: approved, and (if configured) meeting a sales floor. */
export async function activeRecruitCount(affiliateId: string, plan: CompPlan, window: Window) {
  const recruits = await prisma.affiliate.findMany({
    where: { parentAffiliateId: affiliateId, status: "approved" },
    select: { id: true },
  });
  if (plan.activeRecruitMinSales <= 0 || recruits.length === 0) return recruits.length;

  const sales = await prisma.affiliateConversion.groupBy({
    by: ["affiliateId"],
    where: {
      affiliateId: { in: recruits.map((r) => r.id) },
      status: { in: [...COUNTED] },
      createdAt: { gte: window.start, lt: window.end },
    },
    _sum: { eligibleSubtotal: true },
  });
  return sales.filter((s) => (s._sum.eligibleSubtotal ?? 0) >= plan.activeRecruitMinSales).length;
}

export async function isAffiliateQualified(affiliate: Affiliate, plan: CompPlan, window: Window) {
  if (affiliate.status !== "approved") return false;
  const [sales, recruits] = await Promise.all([
    personalSales(affiliate.id, window),
    activeRecruitCount(affiliate.id, plan, window),
  ]);
  return isQualified({ activeRecruits: recruits, personalSales: sales }, plan);
}

export interface UnilevelOutcome {
  result: CommissionResult;
  monthlySales: number;
  /** Paid override recipients, with the affiliate ids the pure calculator doesn't carry. */
  payouts: { affiliateId: string; level: number; slot: number; rate: number; amount: number }[];
}

/**
 * Runs the client's plan for one order: the seller's tier rate off this month's volume (including
 * this order), then walks up the recruiter chain — no depth limit — until five qualified uplines
 * are found or the chain ends.
 */
export async function computeUnilevel(params: {
  seller: Affiliate;
  eligibleSubtotal: number;
  settings: AffiliateSettings;
  at?: Date;
}): Promise<UnilevelOutcome> {
  const { seller, eligibleSubtotal, settings } = params;
  const plan = planFromSettings(settings);
  const window = monthWindow(params.at ?? new Date());

  const monthlySales = (await personalSales(seller.id, window)) + eligibleSubtotal;

  const chain: (UplineInput & { id: string })[] = [];
  const seen = new Set([seller.id]);
  let qualifiedCount = 0;
  let nextId = seller.parentAffiliateId;
  while (
    nextId &&
    !seen.has(nextId) &&
    chain.length < MAX_GENEALOGY_DEPTH &&
    qualifiedCount < plan.overrideSlotRates.length
  ) {
    seen.add(nextId);
    const upline = await prisma.affiliate.findUnique({ where: { id: nextId } });
    if (!upline) break;
    const qualified = await isAffiliateQualified(upline, plan, window);
    chain.push({ id: upline.id, name: upline.displayName ?? upline.userEmail, qualified });
    if (qualified) qualifiedCount += 1;
    nextId = upline.parentAffiliateId;
  }

  const result = calculateCommission(
    { monthlySales, transactionAmount: eligibleSubtotal, uplines: chain },
    plan,
  );

  const payouts = result.overrides
    .filter((o) => o.status === "paid" && o.slot !== null && o.amount > 0)
    .map((o) => ({
      affiliateId: chain[o.level - 1].id,
      level: o.level,
      slot: o.slot as number,
      rate: o.rate,
      amount: o.amount,
    }));

  return { result, monthlySales, payouts };
}
