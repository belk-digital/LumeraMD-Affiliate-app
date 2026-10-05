// Wallet points rules. Pure functions (no database), so the same formula can be used by the order
// webhook, the membership flow and any page that wants to show "you'd earn X".
//
// 1 point = $1 of store credit. Amounts are kept as integer "cents" (1 point = 100 cents) so they
// round like money and never drift.

export interface WalletRules {
  enabled: boolean;
  /** % of an order (after discounts) returned as points. */
  orderEarnPercent: number;
  /** The order subtotal, before discounts, must reach this to earn anything. 0 = every order earns. */
  orderMinSubtotal: number;
  /** % of each membership payment returned as points. 0 = memberships earn nothing. */
  membershipEarnPercent: number;
  /** Smallest amount a member can redeem at once, in cents. */
  minRedeemCents: number;
  /** How long a redeemed code stays valid before the points go back. */
  redeemExpiryDays: number;
}

/** Builds the rules from the admin settings row (only the wallet columns are read). */
export function rulesFromSettings(settings: {
  walletEnabled: boolean;
  walletOrderEarnPercent: number;
  walletOrderMinSubtotal: number;
  walletMembershipEarnPercent: number;
  walletMinRedeem: number;
  walletRedeemExpiryDays: number;
}): WalletRules {
  return {
    enabled: settings.walletEnabled,
    orderEarnPercent: settings.walletOrderEarnPercent,
    orderMinSubtotal: settings.walletOrderMinSubtotal,
    membershipEarnPercent: settings.walletMembershipEarnPercent,
    minRedeemCents: Math.round(settings.walletMinRedeem * 100),
    redeemExpiryDays: settings.walletRedeemExpiryDays,
  };
}

export const toCents = (points: number): number => Math.round((points + Number.EPSILON) * 100);
export const fromCents = (cents: number): number => cents / 100;

/** "12.50" — points always shown with two decimals. */
export const formatPoints = (cents: number): string => (cents / 100).toFixed(2);

export interface OrderEarning {
  earnedCents: number;
  /** What the percentage was applied to: subtotal minus discounts, never below zero. */
  baseCents: number;
  reason: "awarded" | "disabled" | "below_minimum" | "zero_base";
}

/**
 * Points an order earns. The minimum is tested against the gross subtotal (a $350 cart still
 * qualifies with a $100 coupon), but the award is on what the customer actually paid toward
 * merchandise — so a discount code, including a wallet redemption code, can never be recycled
 * into fresh points. Shipping, fees and tax are never part of the base.
 */
export function calculateOrderPoints(
  order: { subtotal: number; discountTotal: number },
  rules: WalletRules,
): OrderEarning {
  const subtotal = Number(order.subtotal) || 0;
  const discountTotal = Number(order.discountTotal) || 0;
  const baseCents = Math.max(0, toCents(subtotal) - toCents(discountTotal));

  if (!rules.enabled) return { earnedCents: 0, baseCents, reason: "disabled" };
  if (subtotal < rules.orderMinSubtotal) return { earnedCents: 0, baseCents, reason: "below_minimum" };
  if (baseCents <= 0) return { earnedCents: 0, baseCents, reason: "zero_base" };

  const earnedCents = Math.round((baseCents * rules.orderEarnPercent) / 100);
  if (earnedCents <= 0) return { earnedCents: 0, baseCents, reason: "zero_base" };
  return { earnedCents, baseCents, reason: "awarded" };
}

export function calculateMembershipPoints(paymentAmount: number, rules: WalletRules): number {
  if (!rules.enabled || !(rules.membershipEarnPercent > 0)) return 0;
  return Math.round((toCents(Number(paymentAmount) || 0) * rules.membershipEarnPercent) / 100);
}

/** Share of an order that a refund covers, 0..1. Unknown amounts count as a full refund. */
export function refundFraction(refundedAmount: number | null, orderTotal: number | null): number {
  if (refundedAmount === null || orderTotal === null || !(orderTotal > 0)) return 1;
  return Math.min(1, Math.max(0, refundedAmount / orderTotal));
}
