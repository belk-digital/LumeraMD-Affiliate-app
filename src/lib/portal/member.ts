import type { CustomerSignup } from "@/generated/prisma/client";
import { DEFAULT_PLANS, type MembershipPlan, type PlanKey } from "@/lib/membership/plans";

// The member as the customer portal sees it. Used by the read API and by every outgoing event, so a
// lookup and a notification always agree. Deliberately small: no names, phone or discount codes.

const TIERS: Record<string, string> = {
  customer_basic: "basic",
  customer_plus: "plus",
  customer_premium: "premium",
  agent: "sales_rep", // a sales rep's own Premium membership
};

export type PortalPaymentStatus = "paid" | "complimentary" | "grace" | "past_due" | "unpaid" | "cancelled" | "paused";

/**
 * paid          - active, current period paid for
 * complimentary - active, granted free by an admin; never expires, paid_through is null
 * grace         - period ended, inside the 3-day grace window; still treated as a member
 * past_due      - grace is over, discount withdrawn
 * unpaid        - signed up, never paid
 * cancelled     - ended
 * paused        - an admin paused it; discount withdrawn until it is switched back on
 */
export function paymentStatus(c: CustomerSignup, now = new Date()): PortalPaymentStatus {
  if (c.status === "cancelled") return "cancelled";
  if (c.status === "pending_payment") return "unpaid";
  if (c.status === "past_due") return "past_due";
  if (c.status === "paused") return "paused";
  if (c.complimentary) return "complimentary";
  if (c.currentPeriodEnd && c.currentPeriodEnd < now) return "grace";
  return "paid";
}

export function portalMember(c: CustomerSignup, now = new Date(), plans: Record<PlanKey, MembershipPlan> = DEFAULT_PLANS) {
  const plan = plans[c.plan as PlanKey];
  const payment_status = paymentStatus(c, now);
  return {
    id: c.id,
    email: c.email,
    tier: TIERS[c.plan] ?? c.plan,
    tier_name: plan?.name ?? c.plan,
    status: c.status,
    payment_status,
    paid_through: c.complimentary ? null : (c.currentPeriodEnd?.toISOString() ?? null),
    complimentary: c.complimentary,
    // The one flag a checkout needs: should this person get the member discount right now?
    discount_eligible: c.status === "active",
    web_discount_percent: plan?.webDiscountPercent ?? 0,
    activated_at: c.activatedAt?.toISOString() ?? null,
    cancelled_at: c.cancelledAt?.toISOString() ?? null,
    updated_at: c.updatedAt.toISOString(),
  };
}

export type PortalMember = ReturnType<typeof portalMember>;
