import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CustomerSignup, MembershipPayment } from "@/generated/prisma/client";
import { PLANS, type PlanKey } from "@/lib/membership/plans";
import { createDiscountCode, deleteDiscountCodeByString } from "@/lib/shopify/client";
import { attributeOrder } from "@/lib/affiliates/commission";
import {
  notifyMembershipActive,
  notifyMembershipCancelled,
  notifyMembershipPastDue,
} from "@/lib/email/membership";

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
  const plan = PLANS[customer.plan as PlanKey];
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

  return { customer: discount.customer, payment, duplicate: false, firstActivation, warnings };
}

/** If enabled in settings, a membership payment earns the referring rep commission like a sale. */
async function creditReferrer(customer: CustomerSignup, payment: MembershipPayment) {
  if (!customer.referredByAffiliateId) return;
  const settings = await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });
  if (!settings.membershipCommissionEnabled) return;

  const plan = PLANS[customer.plan as PlanKey];
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

export async function cancelMembership(customerId: string, opts: LifecycleOptions = {}) {
  const customer = await getCustomer(customerId);
  if (customer.status === "cancelled") {
    throw new MembershipError("This membership is already cancelled.", 409);
  }
  const cancelled = await prisma.customerSignup.update({
    where: { id: customer.id },
    data: { status: "cancelled", cancelledAt: new Date() },
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
  return { customer: discount.customer, warnings: discount.error ? [discount.error] : [] };
}

/** Admin bookkeeping: how many of the plan's included consultations have been used. */
export async function adjustConsultationsUsed(customerId: string, delta: 1 | -1) {
  const customer = await getCustomer(customerId);
  const included = PLANS[customer.plan as PlanKey]?.consultations ?? 0;
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
  return prisma.customerSignup.update({
    where: { id: customer.id },
    data: { consultationsUsed: next },
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
    where: { status: "active", currentPeriodEnd: { lt: cutoff } },
  });
  let markedPastDue = 0;
  for (const customer of lapsed) {
    // Re-check the status in the same statement so a payment that just landed isn't overwritten.
    const res = await prisma.customerSignup.updateMany({
      where: { id: customer.id, status: "active", currentPeriodEnd: { lt: cutoff } },
      data: { status: "past_due" },
    });
    if (res.count === 0) continue;
    markedPastDue += 1;
    const fresh = await getCustomer(customer.id);
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
