import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/metrics";

/**
 * Recomputes an affiliate's cached balances.
 *
 * Team override earnings (what a parent earns when a recruit's order converts) live on the
 * recruit's conversion row (parentAffiliateId + parentCommissionAmount), and are payable out of the
 * same balance as the affiliate's own commission. A conversion has a single status shared by the
 * seller and the parent, so "paid" can't be read off it for the parent's share; instead the
 * balances are amount-based:
 *
 *   pending  = own pending + team pending
 *   pool     = own (approved | paid) + team (approved | paid)     // matured earnings
 *   paid     = sum of payouts marked paid
 *   approved = pool - paid                                         // matured, not yet paid out
 *   earned   = pending + pool
 *
 * "Available to request" is `approved` minus payouts still in flight (see the payout routes).
 */
export async function updateAffiliateStats(affiliateId: string) {
  const [totalClicks, own, team, paidPayouts] = await Promise.all([
    prisma.affiliateClick.count({ where: { affiliateId } }),
    prisma.affiliateConversion.findMany({
      where: { affiliateId },
      select: { status: true, commissionAmount: true },
    }),
    prisma.affiliateConversion.findMany({
      where: { parentAffiliateId: affiliateId, status: { in: ["pending", "approved", "paid"] } },
      select: { status: true, parentCommissionAmount: true },
    }),
    prisma.affiliatePayout.aggregate({
      where: { affiliateId, status: "paid" },
      _sum: { amount: true },
    }),
  ]);

  const ownSum = (statuses: string[]) =>
    own
      .filter((c) => statuses.includes(c.status))
      .reduce((acc, c) => acc + c.commissionAmount, 0);
  const teamSum = (statuses: string[]) =>
    team
      .filter((c) => statuses.includes(c.status))
      .reduce((acc, c) => acc + (c.parentCommissionAmount ?? 0), 0);

  const pending = ownSum(["pending"]) + teamSum(["pending"]);
  const pool = ownSum(["approved", "paid"]) + teamSum(["approved", "paid"]);
  const paid = paidPayouts._sum.amount ?? 0;

  const totalConversions = own.filter((c) =>
    ["pending", "approved", "paid"].includes(c.status),
  ).length;

  await prisma.affiliate.update({
    where: { id: affiliateId },
    data: {
      totalClicks,
      totalConversions,
      totalCommissionPending: round2(pending),
      totalCommissionApproved: round2(Math.max(pool - paid, 0)),
      totalCommissionPaid: round2(paid),
      totalCommissionEarned: round2(pending + Math.max(pool, paid)),
    },
  });
}
