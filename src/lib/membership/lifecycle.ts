import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CustomerSignup, MembershipPayment } from "@/generated/prisma/client";
import type { PlanKey } from "@/lib/membership/plans";
import { getCatalog } from "@/lib/membership/plans.server";
import { createDiscountCode, deleteDiscountCodeByString } from "@/lib/shopify/client";
import { attributeOrder } from "@/lib/affiliates/commission";
import { awardMembershipPoints } from "@/lib/wallet/service";
import { cancelSubscription } from "@/lib/authnet/client";
import { emitPortalEvent } from "@/lib/portal/events";
import {
  notifyMembershipActive,
  notifyMembershipCancelled,
  notifyMembershipComplimentary,
  notifyMembershipPastDue,
  notifyMembershipPaused,
  notifyMembershipPaymentLink,
  payLinkFor,
  notifyMembershipResumed,
} from "@/lib/email/membership";
import { resumeMemberCardBilling } from "@/lib/authnet/repBilling";

// Membership lifecycle. A payment provider (or an admin, by hand) calls recordMembershipPayment;
// everything else in the product — discounts, emails, rep commission, the customer's account — is
// driven from the state it leaves behind.

/** Days after a period ends before an unpaid membership is marked past due. */
export const GRACE_DAYS = 3;

export class MembershipError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

export interface LifecycleOptions {
  /** Don't touch the Shopify store (tests). Discount state is still recorded as if it worked. */
  skipShopify?: boolean;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alikes (0/O, 1/I)

function generateDiscountCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return `MEMBER-${s}`;
}

/** Same day next month, clamped to the month's length (Jan 31 -> Feb 28/29). */
export function addOneMonth(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const lastDayNextMonth = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      y,
      m + 1,
      Math.min(d.getUTCDate(), lastDayNextMonth),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
    ),
  );
}

async function getCustomer(id: string) {
  const customer = await prisma.customerSignup.findUnique({ where: { id } });
  if (!customer) throw new MembershipError("Membership not found.", 404);
  return customer;
}

/**
 * Makes sure the member has a live discount code in Shopify (percent from their plan). A Shopify
 * failure never blocks activation — the error is returned so an admin can see it and a later
 * payment or the cron job retries.
 */
async function ensureMemberDiscount(
  customer: CustomerSignup,
  opts: LifecycleOptions,
): Promise<{ customer: CustomerSignup; error?: string }> {
  if (customer.memberDiscountActive && customer.memberDiscountCode) return { customer };
  const plan = (await getCatalog()).plans[customer.plan as PlanKey];
  if (!plan || plan.webDiscountPercent <= 0) return { customer };

  const hadCode = !!customer.memberDiscountCode;
  let code = customer.memberDiscountCode ?? generateDiscountCode();

  if (!opts.skipShopify) {
    for (let attempt = 0; ; attempt++) {
      try {
        await createDiscountCode({
          title: `Member discount: ${customer.email}`,
          code,
          valueType: "percentage",
          value: plan.webDiscountPercent,
        });
        break;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const taken = /taken|already|exist/i.test(message);
        if (taken && hadCode) break; // our own earlier code is still live in Shopify
        if (taken && !hadCode && attempt < 3) {
          code = generateDiscountCode();
          continue;
        }
        console.error("Member discount creation failed", message);
        return { customer, error: `Could not create the member discount in Shopify: ${message}` };
      }
    }
  }

  const updated = await prisma.customerSignup.update({
    where: { id: customer.id },
    data: { memberDiscountCode: code, memberDiscountActive: true },
  });
  return { customer: updated };
}

/** Removes the member's discount code from Shopify. Left marked active if Shopify fails, so it's retried. */
async function removeMemberDiscount(
  customer: CustomerSignup,
  opts: LifecycleOptions,
): Promise<{ customer: CustomerSignup; error?: string }> {
  if (!customer.memberDiscountActive || !customer.memberDiscountCode) return { customer };
  if (!opts.skipShopify) {
    try {
      await deleteDiscountCodeByString(customer.memberDiscountCode);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Member discount removal failed", message);
      return { customer, error: `Could not remove the member discount from Shopify: ${message}` };
    }
  }
  const updated = await prisma.customerSignup.update({
    where: { id: customer.id },
    data: { memberDiscountActive: false },
  });
  return { customer: updated };
}

export interface PaymentResult {
  customer: CustomerSignup;
  payment: MembershipPayment;
  /** True when this externalId was already recorded; nothing was changed. */
  duplicate: boolean;
  firstActivation: boolean;
  warnings: string[];
}

/**
 * Records a membership payment: activates the membership (or renews it, or brings back a lapsed or
 * cancelled one), extends it by a month, grants the member discount, emails the customer and — if
 * the program setting is on — credits the referring rep. Idempotent per (source, externalId).
 */
export async function recordMembershipPayment(
  params: {
    customerId: string;
    amount: number;
    source: string;
    externalId?: string;
    note?: string;
    at?: Date;
  },
  opts: LifecycleOptions = {},
): Promise<PaymentResult> {
  if (!Number.isFinite(params.amount) || params.amount <= 0 || params.amount > 100_000) {
    throw new MembershipError("Enter a payment amount between $0.01 and $100,000.", 400);
  }
  const customer = await getCustomer(params.customerId);

  if (params.externalId) {
    const existing = await prisma.membershipPayment.findUnique({
      where: { source_externalId: { source: params.source, externalId: params.externalId } },
    });
    if (existing) {
      return { customer, payment: existing, duplicate: true, firstActivation: false, warnings: [] };
    }
  }

  const now = params.at ?? new Date();
  const stillCovered =
    customer.status === "active" && customer.currentPeriodEnd && customer.currentPeriodEnd > now;
  const periodStart = stillCovered ? customer.currentPeriodEnd! : now;
  const periodEnd = addOneMonth(periodStart);
  const firstActivation = customer.activatedAt === null;

  // The price they pay is fixed the first time they pay, so a later change to the plan only affects new signups.
  const priceNow = (await getCatalog()).plans[customer.plan as PlanKey]?.monthlyPrice ?? null;
  const { payment, updated } = await prisma.$transaction(async (tx) => {
    const payment = await tx.membershipPayment.create({
      data: {
        customerId: customer.id,
        amount: params.amount,
        source: params.source,
        externalId: params.externalId,
        periodStart,
        periodEnd,
        note: params.note,
      },
    });
    const updated = await tx.customerSignup.update({
      where: { id: customer.id },
      data: {
        status: "active",
        activatedAt: customer.activatedAt ?? now,
        cancelledAt: null,
        currentPeriodEnd: periodEnd,
        complimentary: false,
        lockedMonthlyPrice: customer.lockedMonthlyPrice ?? priceNow,
      },
    });
    return { payment, updated };
  });

  const warnings: string[] = [];
  const discount = await ensureMemberDiscount(updated, opts);
  if (discount.error) warnings.push(discount.error);

  try {
    await notifyMembershipActive(discount.customer, {
      discountCode: discount.customer.memberDiscountActive ? discount.customer.memberDiscountCode : null,
      firstActivation,
    });
  } catch (err) {
    console.error("Membership email failed", err);
  }

  try {
    await creditReferrer(discount.customer, payment);
  } catch (err) {
    console.error("Membership commission failed", err);
    warnings.push("The payment was recorded, but crediting the referring rep failed.");
  }

  try {
    await awardMembershipPoints(discount.customer.email, { id: payment.id, amount: payment.amount });
  } catch (err) {
    console.error("Membership wallet points failed", err);
    warnings.push("The payment was recorded, but awarding wallet points failed.");
  }

  await emitPortalEvent("membership.payment_succeeded", customer.id, {
    payment: {
      id: payment.id,
      amount: payment.amount,
      currency: "USD",
      paid_at: payment.createdAt.toISOString(),
      period_start: payment.periodStart.toISOString(),
      period_end: payment.periodEnd.toISOString(),
      first_payment: firstActivation,
    },
  });

  return { customer: discount.customer, payment, duplicate: false, firstActivation, warnings };
}

/** If enabled in settings, a membership payment earns the referring rep commission like a sale. */
async function creditReferrer(customer: CustomerSignup, payment: MembershipPayment) {
  if (!customer.referredByAffiliateId) return;
  // An agent's own $79 is a fee, not a sale: it never earns anyone commission or overrides.
  if (customer.plan === "agent") return;
  const settings = await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });
  if (!settings.membershipCommissionEnabled) return;

  const plan = (await getCatalog()).plans[customer.plan as PlanKey];
  await attributeOrder({
    order: {
      id: `membership:${payment.id}`,
      name: `${plan?.name ?? "Membership"} membership`,
      subtotalPrice: payment.amount,
      totalDiscounts: 0,
      discountCodes: [],
      customerEmail: customer.email,
    },
    cookieAffiliateId: customer.referredByAffiliateId,
    cookieClickId: null,
  });
}

/**
 * Admin grants access without a payment (a friend, a partner). Activates the membership with no end
 * date, turns on the member discount and welcomes the member. It records no payment, so it earns no
 * wallet points and pays no rep commission, and the daily lapse check skips it. Cancelling it, or
 * recording a real payment, ends the complimentary status.
 */
export async function grantComplimentary(
  customerId: string,
  params: { note: string; adminEmail?: string },
  opts: LifecycleOptions = {},
) {
  const note = params.note.trim().slice(0, 500);
  if (!note) throw new MembershipError("Add a note saying who this is and why, so it is on record.", 400);
  const customer = await getCustomer(customerId);
  if (customer.complimentary && customer.status === "active") {
    throw new MembershipError("This membership is already complimentary.", 409);
  }
  const firstActivation = customer.activatedAt === null;

  // A member being billed monthly by card must stop being charged: otherwise "free" would still take money
  // every month (and the next payment would end the complimentary status). If Authorize.net can't be
  // reached the id stays on the record and the admin is told to cancel it by hand.
  const billingWarnings: string[] = [];
  let clearSubscription = false;
  if (customer.authnetSubscriptionId) {
    try {
      await cancelSubscription(customer.authnetSubscriptionId);
      clearSubscription = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/cancel|terminat/i.test(message)) {
        clearSubscription = true; // already stopped on their side
      } else {
        console.error("Authorize.net subscription cancel failed", customer.authnetSubscriptionId, message);
        billingWarnings.push(
          `The membership is now complimentary, but its Authorize.net subscription (${customer.authnetSubscriptionId}) could not be stopped: ${message}. Cancel it in Authorize.net so they are not charged again.`,
        );
      }
    }
  }

  const updated = await prisma.customerSignup.update({
    where: { id: customer.id },
    data: {
      status: "active",
      activatedAt: customer.activatedAt ?? new Date(),
      cancelledAt: null,
      currentPeriodEnd: null,
      ...(clearSubscription ? { authnetSubscriptionId: null } : {}),
      complimentary: true,
      complimentaryNote: note,
      complimentaryBy: params.adminEmail ?? null,
    },
  });

  const warnings: string[] = [...billingWarnings];
  const discount = await ensureMemberDiscount(updated, opts);
  if (discount.error) warnings.push(discount.error);
  try {
    await notifyMembershipComplimentary(discount.customer, {
      discountCode: discount.customer.memberDiscountActive ? discount.customer.memberDiscountCode : null,
      firstActivation,
      cardStopped: clearSubscription,
    });
  } catch (err) {
    console.error("Membership email failed", err);
  }
  await emitPortalEvent("membership.complimentary_granted", customer.id);
  return { customer: discount.customer, warnings };
}

export async function cancelMembership(customerId: string, opts: LifecycleOptions = {}) {
  const customer = await getCustomer(customerId);
  if (customer.status === "cancelled") {
    throw new MembershipError("This membership is already cancelled.", 409);
  }
  // Stop the monthly card charge first, so a cancelled member is never billed again. If Authorize.net
  // can't be reached the id stays on the record and the admin is told to cancel it by hand.
  const billingWarnings: string[] = [];
  let clearSubscription = false;
  if (customer.authnetSubscriptionId) {
    try {
      await cancelSubscription(customer.authnetSubscriptionId);
      clearSubscription = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/cancel|terminat/i.test(message)) {
        clearSubscription = true; // already stopped on their side
      } else {
        console.error("Authorize.net subscription cancel failed", customer.authnetSubscriptionId, message);
        billingWarnings.push(
          `The membership was cancelled, but its Authorize.net subscription (${customer.authnetSubscriptionId}) could not be stopped: ${message}. Cancel it in Authorize.net so they are not charged again.`,
        );
      }
    }
  }
  const cancelled = await prisma.customerSignup.update({
    where: { id: customer.id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      complimentary: false,
      ...(clearSubscription ? { authnetSubscriptionId: null } : {}),
    },
  });
  const discount = await removeMemberDiscount(cancelled, opts);

  // Only tell the customer if they had actually been a paying member.
  if (customer.activatedAt) {
    try {
      await notifyMembershipCancelled(discount.customer);
    } catch (err) {
      console.error("Membership email failed", err);
    }
  }
  await emitPortalEvent("membership.cancelled", customer.id);
  return {
    customer: discount.customer,
    warnings: [...(discount.error ? [discount.error] : []), ...billingWarnings],
  };
}

/**
 * Admin pauses a membership: any monthly card charge is stopped (the saved card is kept), the member discount
 * is withdrawn and the member is told. The record, paid-through date and any complimentary status are kept, so
 * switching it back on needs no new payment while the period is still paid.
 */
export async function pauseMembership(customerId: string, opts: LifecycleOptions = {}) {
  const customer = await getCustomer(customerId);
  if (customer.status === "paused") throw new MembershipError("This membership is already paused.", 409);
  if (customer.status === "cancelled") throw new MembershipError("A cancelled membership cannot be paused.", 409);
  if (customer.status === "pending_payment") {
    throw new MembershipError("This membership has not started yet, so there is nothing to pause.", 409);
  }

  const warnings: string[] = [];
  let clearSubscription = false;
  if (customer.authnetSubscriptionId) {
    try {
      await cancelSubscription(customer.authnetSubscriptionId);
      clearSubscription = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/cancel|terminat/i.test(message)) {
        clearSubscription = true;
      } else {
        console.error("Authorize.net subscription cancel failed", customer.authnetSubscriptionId, message);
        warnings.push(
          `The membership is paused, but its Authorize.net subscription (${customer.authnetSubscriptionId}) could not be stopped: ${message}. Cancel it in Authorize.net so they are not charged while paused.`,
        );
      }
    }
  }
  const paused = await prisma.customerSignup.update({
    where: { id: customer.id },
    data: { status: "paused", ...(clearSubscription ? { authnetSubscriptionId: null } : {}) },
  });
  const discount = await removeMemberDiscount(paused, opts);
  if (discount.error) warnings.push(discount.error);
  try {
    await notifyMembershipPaused(discount.customer, { cardStopped: clearSubscription });
  } catch (err) {
    console.error("Membership email failed", err);
  }
  return { customer: discount.customer, warnings };
}

/**
 * Admin switches a paused membership back on. A complimentary one simply comes back. A paid one comes back only
 * while its paid period has not ended (so nothing is given away); the card billing restarts from the saved card.
 * If the period ran out while paused, it stays paused and the admin is told to send the payment link.
 */
export async function activateMembership(customerId: string, opts: LifecycleOptions = {}) {
  const customer = await getCustomer(customerId);
  if (customer.status !== "paused") throw new MembershipError("Only a paused membership can be switched back on.", 409);
  if (!customer.complimentary && !(customer.currentPeriodEnd && customer.currentPeriodEnd > new Date())) {
    throw new MembershipError(
      "Their paid period ended while the membership was paused, so it cannot simply be switched on. Send them the payment link to renew, or make it complimentary.",
      409,
    );
  }
  const active = await prisma.customerSignup.update({ where: { id: customer.id }, data: { status: "active" } });
  const warnings: string[] = [];
  const discount = await ensureMemberDiscount(active, opts);
  if (discount.error) warnings.push(discount.error);
  const billing = await resumeMemberCardBilling(discount.customer);
  warnings.push(...billing.warnings);
  try {
    await notifyMembershipResumed(discount.customer, {
      discountCode: discount.customer.memberDiscountActive ? discount.customer.memberDiscountCode : null,
      billingResumed: billing.started,
    });
  } catch (err) {
    console.error("Membership email failed", err);
  }
  return { customer: discount.customer, warnings };
}

/**
 * Admin emails the member their payment link: to start paying, to settle an overdue payment, or to switch a paused
 * membership back on once its paid period has ended (a paused one that is still paid is switched on with
 * activateMembership instead, so nobody pays twice). Paying through the link activates the membership.
 */
export async function sendPaymentLink(customerId: string) {
  const customer = await getCustomer(customerId);
  if (customer.status === "active") throw new MembershipError("This membership is already active, so there is nothing to pay.", 409);
  if (customer.status === "cancelled") throw new MembershipError("A cancelled membership cannot be paid for.", 409);
  if (customer.status === "paused" && (customer.complimentary || (customer.currentPeriodEnd && customer.currentPeriodEnd > new Date()))) {
    throw new MembershipError("This paused membership is still paid up. Use Activate to switch it back on; no payment is needed.", 409);
  }
  const link = payLinkFor(customer);
  if (!link) throw new MembershipError("Online payment is not set up yet, so there is no payment link to send.", 400);
  try {
    await notifyMembershipPaymentLink(customer, link);
  } catch (err) {
    console.error("Payment link email failed", err);
    throw new MembershipError("The email could not be sent. Copy the payment link from the card and send it yourself.", 400);
  }
  return { link };
}

/** Admin bookkeeping: how many of the plan's included consultations have been used. */
export async function adjustConsultationsUsed(
  customerId: string,
  delta: 1 | -1,
  opts: { note?: string; adminEmail?: string } = {},
) {
  const customer = await getCustomer(customerId);
  const included = (await getCatalog()).plans[customer.plan as PlanKey]?.consultations ?? 0;
  if (included === 0) {
    throw new MembershipError("This plan doesn't include consultations.", 400);
  }
  const next = customer.consultationsUsed + delta;
  if (next < 0 || next > included) {
    throw new MembershipError(
      delta > 0 ? "All included consultations are already used." : "No consultations have been used.",
      400,
    );
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.customerSignup.update({
      where: { id: customer.id },
      data: { consultationsUsed: next },
    });
    if (delta === 1) {
      await tx.memberConsultation.create({
        data: {
          customerId: customer.id,
          notes: opts.note?.trim().slice(0, 500) || null,
          createdBy: opts.adminEmail,
        },
      });
    } else {
      const latest = await tx.memberConsultation.findFirst({
        where: { customerId: customer.id },
        orderBy: { occurredAt: "desc" },
      });
      if (latest) await tx.memberConsultation.delete({ where: { id: latest.id } });
    }
    return updated;
  });
}

/**
 * Daily housekeeping (called from the cron job): active memberships past their period plus the
 * grace window become past due and lose their discount; any past-due or cancelled member who
 * still has a live Shopify code gets it removed (retrying earlier failures).
 */
export async function processMembershipLifecycle(opts: LifecycleOptions = {}, now = new Date()) {
  const cutoff = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000);

  const lapsed = await prisma.customerSignup.findMany({
    where: { status: "active", complimentary: false, currentPeriodEnd: { lt: cutoff } },
  });
  let markedPastDue = 0;
  for (const customer of lapsed) {
    // Re-check the status in the same statement so a payment that just landed isn't overwritten.
    const res = await prisma.customerSignup.updateMany({
      where: { id: customer.id, status: "active", complimentary: false, currentPeriodEnd: { lt: cutoff } },
      data: { status: "past_due" },
    });
    if (res.count === 0) continue;
    markedPastDue += 1;
    await emitPortalEvent("membership.expired", customer.id);
    const fresh = await getCustomer(customer.id);
    // A suspended rep can't use the program, so don't ask them to pay for it; reactivation sorts out billing.
    if (fresh.plan === "agent") {
      const suspended = await prisma.affiliate.findFirst({
        where: { userEmail: { equals: fresh.email, mode: "insensitive" }, status: "suspended" },
        select: { id: true },
      });
      if (suspended) continue;
    }
    try {
      await notifyMembershipPastDue(fresh);
    } catch (err) {
      console.error("Membership email failed", err);
    }
  }

  const needsRemoval = await prisma.customerSignup.findMany({
    where: { status: { in: ["past_due", "cancelled"] }, memberDiscountActive: true },
  });
  let discountsRemoved = 0;
  const errors: string[] = [];
  for (const customer of needsRemoval) {
    const result = await removeMemberDiscount(customer, opts);
    if (result.error) errors.push(`${customer.email}: ${result.error}`);
    else discountsRemoved += 1;
  }

  return { markedPastDue, discountsRemoved, errors };
}
