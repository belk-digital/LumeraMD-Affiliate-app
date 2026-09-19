import { prisma } from "@/lib/prisma";
import type { Affiliate } from "@/generated/prisma/client";
import { updateAffiliateStats } from "@/lib/affiliates/stats";
import { round2 } from "@/lib/metrics";
import {
  notifyNewConversion,
  notifyParentOverrideEarning,
} from "@/lib/email/notifications";
import { createNotification } from "@/lib/notifications/create";

export interface ShopifyOrderInput {
  id: string; // Shopify order id (gid or numeric, stored as string)
  name: string; // e.g. "#1001"
  subtotalPrice: number;
  totalDiscounts: number;
  discountCodes: string[];
  customerEmail: string | null;
}

function computeCommission(affiliate: Affiliate, order: ShopifyOrderInput) {
  const eligibleSubtotal =
    affiliate.commissionOn === "subtotal_after_coupon"
      ? Math.max(order.subtotalPrice - order.totalDiscounts, 0)
      : order.subtotalPrice;

  const commissionAmount =
    affiliate.commissionType === "percent"
      ? (eligibleSubtotal * affiliate.commissionRate) / 100
      : affiliate.commissionRate;

  return { eligibleSubtotal, commissionAmount: round2(commissionAmount) };
}

async function findAffiliateByCookie(cookieAffiliateId: string | null) {
  if (!cookieAffiliateId) return null;
  return prisma.affiliate.findUnique({ where: { id: cookieAffiliateId } });
}

async function findAffiliateByDiscountCode(codes: string[]) {
  if (codes.length === 0) return null;
  return prisma.affiliate.findFirst({
    where: { shopifyDiscountCode: { in: codes } },
  });
}

export async function attributeOrder(params: {
  order: ShopifyOrderInput;
  cookieAffiliateId: string | null;
  cookieClickId: string | null;
}) {
  const { order, cookieAffiliateId, cookieClickId } = params;

  const existing = await prisma.affiliateConversion.findUnique({
    where: { shopifyOrderId: order.id },
  });
  if (existing) return existing; // idempotent — webhook retries are safe

  const byCoupon = await findAffiliateByDiscountCode(order.discountCodes);
  const byCookie = await findAffiliateByCookie(cookieAffiliateId);

  let affiliate = byCoupon ?? byCookie;
  if (!affiliate) return null;

  let attributionSource: "referral_link" | "coupon_code" | "both" = byCoupon
    ? "coupon_code"
    : "referral_link";
  if (byCoupon && byCookie && byCoupon.id === byCookie.id) {
    attributionSource = "both";
  }

  // One-shot attribution: a referral-link click can only convert once.
  let attributionClickId: string | null = null;
  if (attributionSource !== "coupon_code" && cookieClickId) {
    const click = await prisma.affiliateClick.findUnique({
      where: { id: cookieClickId },
    });
    if (click && !click.convertedToOrder) {
      attributionClickId = click.id;
    } else if (click && click.convertedToOrder && !byCoupon) {
      // Click already spent and no coupon backing this order — not attributable.
      return null;
    }
  }

  const selfReferralDetected =
    order.customerEmail !== null &&
    order.customerEmail.toLowerCase() === affiliate.userEmail.toLowerCase();

  const { eligibleSubtotal, commissionAmount } = computeCommission(affiliate, order);

  const pendingUntil = new Date();
  pendingUntil.setDate(pendingUntil.getDate() + affiliate.pendingPeriodDays);

  // Multi-tier: the recruiter earns an override on top, off the same eligible subtotal as the
  // seller's own commission (it is not taken out of the seller's share). The rate is the
  // PARENT's, and only an approved parent earns it.
  let parentAffiliateId: string | null = null;
  let parentCommissionRate: number | null = null;
  let parentCommissionAmount: number | null = null;
  if (affiliate.parentAffiliateId) {
    const parent = await prisma.affiliate.findUnique({
      where: { id: affiliate.parentAffiliateId },
    });
    if (parent && parent.status === "approved") {
      // A blank rate on the parent means "use the program default".
      const settings = await prisma.affiliateSettings.upsert({
        where: { id: "global" },
        update: {},
        create: { id: "global" },
      });
      const rate = parent.parentOverrideRate ?? settings.defaultParentOverrideRate;
      parentAffiliateId = parent.id;
      parentCommissionRate = rate;
      parentCommissionAmount = round2((eligibleSubtotal * rate) / 100);
    }
  }

  const conversion = await prisma.affiliateConversion.create({
    data: {
      affiliateId: affiliate.id,
      shopifyOrderId: order.id,
      shopifyOrderName: order.name,
      attributionSource,
      attributionClickId,
      orderSubtotal: order.subtotalPrice,
      orderDiscount: order.totalDiscounts,
      eligibleSubtotal,
      commissionRate: affiliate.commissionRate,
      commissionAmount: selfReferralDetected ? 0 : commissionAmount,
      parentAffiliateId,
      parentCommissionRate,
      parentCommissionAmount: selfReferralDetected ? null : parentCommissionAmount,
      status: selfReferralDetected ? "voided" : "pending",
      pendingUntil: selfReferralDetected ? null : pendingUntil,
      selfReferralDetected,
      fraudScore: selfReferralDetected ? 100 : 0,
    },
  });

  if (attributionClickId) {
    await prisma.affiliateClick.update({
      where: { id: attributionClickId },
      data: { convertedToOrder: true, conversionId: conversion.id },
    });
  }

  await updateAffiliateStats(affiliate.id);
  await notifyNewConversion(affiliate, conversion);

  if (!selfReferralDetected) {
    await createNotification(affiliate.id, {
      type: "commission_earned",
      title: `You earned $${conversion.commissionAmount.toFixed(2)}`,
      body: `Order ${order.name} — pending for ${affiliate.pendingPeriodDays} days before it's available for payout.`,
    });
  }

  if (parentAffiliateId && parentCommissionAmount) {
    await updateAffiliateStats(parentAffiliateId);
    const parent = await prisma.affiliate.findUnique({
      where: { id: parentAffiliateId },
    });
    if (parent) {
      await notifyParentOverrideEarning(parent, parentCommissionAmount);
      await createNotification(parent.id, {
        type: "team_earning",
        title: `Your team earned you $${parentCommissionAmount.toFixed(2)}`,
        body: "Someone on your team made a sale.",
      });
    }
  }

  return conversion;
}

export async function reverseConversion(shopifyOrderId: string, reason: string) {
  const conversion = await prisma.affiliateConversion.findUnique({
    where: { shopifyOrderId },
  });
  if (!conversion || conversion.status === "reversed") return conversion;

  const updated = await prisma.affiliateConversion.update({
    where: { shopifyOrderId },
    data: { status: "reversed", reversedReason: reason },
  });

  await updateAffiliateStats(updated.affiliateId);
  if (updated.parentAffiliateId) {
    await updateAffiliateStats(updated.parentAffiliateId);
  }

  await createNotification(updated.affiliateId, {
    type: "commission_reversed",
    title: `Commission reversed: $${updated.commissionAmount.toFixed(2)}`,
    body: `Order ${updated.shopifyOrderName ?? ""} was refunded or cancelled.`.trim(),
  });

  return updated;
}
