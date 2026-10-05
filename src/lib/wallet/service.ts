import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createDiscountCode, deleteDiscountCodeByString } from "@/lib/shopify/client";
import {
  creditWallet,
  debitWallet,
  ensureWalletAccount,
  WalletError,
} from "@/lib/wallet/ledger";
import {
  calculateMembershipPoints,
  calculateOrderPoints,
  refundFraction,
  rulesFromSettings,
  toCents,
  type WalletRules,
} from "@/lib/wallet/rules";

// Everything that moves points because something happened elsewhere: a paid order, a refund, a
// membership payment, a member redeeming, a code expiring, or an admin adjusting. All of it goes
// through the ledger, so each step is atomic and safe to retry.

export const CODE_PREFIX = "WALLET-";
/** A member can hold at most this many unused codes at once. */
const MAX_PENDING_CODES = 5;
/** Expiry runs daily; wait this long past the deadline so a late "order paid" webhook still lands. */
const EXPIRY_GRACE_MS = 24 * 60 * 60 * 1000;

export interface ServiceOptions {
  /** Don't touch the Shopify store (tests, local development). */
  skipShopify?: boolean;
}

export async function getWalletRules(): Promise<WalletRules> {
  const settings = await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });
  return rulesFromSettings(settings);
}

/** Only active members hold and earn wallet points; a lapsed or cancelled member earns nothing new. */
export function findActiveMember(email: string) {
  return prisma.customerSignup.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" }, status: "active" },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------------------------
// Earning
// ---------------------------------------------------------------------------------------------

export interface PaidOrder {
  id: string;
  name: string;
  email: string | null;
  /** Merchandise subtotal before discounts. */
  subtotal: number;
  discountTotal: number;
  /** What the customer paid in total (used to size later partial refunds). */
  total: number;
  discountCodes: string[];
}

export interface PaidOrderResult {
  redemptionUsed: boolean;
  earnedCents: number;
  reason: string;
}

/**
 * Called when Shopify tells us an order was paid. Does two independent things:
 *   1. if the order used a wallet code, marks that redemption as used;
 *   2. if the buyer is an active member, awards points on the order.
 * Safe to call again for the same order (webhook retries): every step is idempotent.
 */
export async function handlePaidOrder(order: PaidOrder): Promise<PaidOrderResult> {
  const result: PaidOrderResult = { redemptionUsed: false, earnedCents: 0, reason: "" };

  for (const raw of order.discountCodes) {
    const code = raw.trim().toUpperCase();
    if (!code.startsWith(CODE_PREFIX)) continue;
    const used = await prisma.walletRedemption.updateMany({
      where: { code, status: "pending" },
      data: { status: "used", usedAt: new Date(), usedOrderId: order.id, usedOrderTotalCents: toCents(order.total) },
    });
    if (used.count > 0) {
      result.redemptionUsed = true;
      continue;
    }
    // The code was used after we had already expired it and handed the points back. Take them back
    // again (as far as the balance allows) so the customer can't have both.
    const late = await prisma.walletRedemption.findUnique({ where: { code }, include: { account: true } });
    if (late && late.status === "expired" && !late.usedOrderId) {
      await prisma.walletRedemption.update({
        where: { id: late.id },
        data: { usedAt: new Date(), usedOrderId: order.id, usedOrderTotalCents: toCents(order.total) },
      });
      await debitWallet({
        kind: late.account.kind,
        ownerKey: late.account.ownerKey,
        amountCents: late.amountCents,
        type: "clawback",
        allowPartial: true,
        reason: "Wallet code was used after it expired",
        sourceType: "redemption",
        sourceId: late.id,
        idempotencyKey: `redemption:${late.id}:late-use`,
      });
      result.redemptionUsed = true;
    }
  }

  const rules = await getWalletRules();
  if (!rules.enabled) return { ...result, reason: "disabled" };
  if (!order.email) return { ...result, reason: "no_email" };
  const member = await findActiveMember(order.email);
  if (!member) return { ...result, reason: "not_member" };

  const earning = calculateOrderPoints({ subtotal: order.subtotal, discountTotal: order.discountTotal }, rules);
  if (earning.earnedCents <= 0) return { ...result, reason: earning.reason };

  const credit = await creditWallet({
    kind: "customer",
    ownerKey: order.email,
    amountCents: earning.earnedCents,
    type: "earn",
    reason: `Order ${order.name}`,
    sourceType: "shopify_order",
    sourceId: order.id,
    idempotencyKey: `order:${order.id}:earn`,
    meta: {
      orderTotal: order.total,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      baseCents: earning.baseCents,
      percent: rules.orderEarnPercent,
    },
  });
  return { ...result, earnedCents: credit.applied ? earning.earnedCents : 0, reason: credit.applied ? "awarded" : "duplicate" };
}

/** Points back to the member for a membership payment, if the program is set up to do that. */
export async function awardMembershipPoints(customerEmail: string, payment: { id: string; amount: number }) {
  const rules = await getWalletRules();
  const cents = calculateMembershipPoints(payment.amount, rules);
  if (cents <= 0) return null;
  return creditWallet({
    kind: "customer",
    ownerKey: customerEmail,
    amountCents: cents,
    type: "earn",
    reason: "Membership payment",
    sourceType: "membership_payment",
    sourceId: payment.id,
    idempotencyKey: `membership:${payment.id}:earn`,
    meta: { amount: payment.amount, percent: rules.membershipEarnPercent },
  });
}

// ---------------------------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------------------------

export interface RefundEvent {
  orderId: string;
  refundId: string;
  /** Money refunded in this event, or null if unknown (treated as a full refund). */
  refundedAmount: number | null;
}

/**
 * A refund takes back the points the order earned and returns points the customer spent on it, each
 * in proportion to how much of the order was refunded, and never more than was earned/spent. The
 * clawback floors at zero: if the customer already spent the points we take what is left rather
 * than leaving them in debt.
 */
export async function handleRefund(event: RefundEvent): Promise<{ clawedBackCents: number; returnedCents: number }> {
  const out = { clawedBackCents: 0, returnedCents: 0 };

  const earn = await prisma.walletTransaction.findUnique({
    where: { idempotencyKey: `order:${event.orderId}:earn` },
    include: { account: true },
  });
  if (earn && earn.amountCents > 0) {
    const meta = (earn.meta ?? {}) as { orderTotal?: number };
    const fraction = refundFraction(event.refundedAmount, meta.orderTotal ?? null);
    const prior = await prisma.walletTransaction.aggregate({
      where: { sourceType: "shopify_order", sourceId: event.orderId, type: "clawback" },
      _sum: { amountCents: true },
    });
    const alreadyClawed = -(prior._sum.amountCents ?? 0);
    const target = Math.min(earn.amountCents - alreadyClawed, Math.round(earn.amountCents * fraction));
    if (target > 0) {
      const r = await debitWallet({
        kind: earn.account.kind,
        ownerKey: earn.account.ownerKey,
        amountCents: target,
        type: "clawback",
        allowPartial: true,
        reason: "Points taken back for a refund",
        sourceType: "shopify_order",
        sourceId: event.orderId,
        idempotencyKey: `refund:${event.refundId}:clawback`,
      });
      out.clawedBackCents = Math.abs(r.appliedCents);
    }
  }

  const redemption = await prisma.walletRedemption.findFirst({
    where: { usedOrderId: event.orderId },
    include: { account: true },
  });
  if (redemption) {
    const fraction = refundFraction(
      event.refundedAmount,
      redemption.usedOrderTotalCents !== null ? redemption.usedOrderTotalCents / 100 : null,
    );
    const prior = await prisma.walletTransaction.aggregate({
      where: { sourceType: "redemption_refund", sourceId: redemption.id, type: "refund" },
      _sum: { amountCents: true },
    });
    const alreadyReturned = prior._sum.amountCents ?? 0;
    const target = Math.min(redemption.amountCents - alreadyReturned, Math.round(redemption.amountCents * fraction));
    if (target > 0) {
      const r = await creditWallet({
        kind: redemption.account.kind,
        ownerKey: redemption.account.ownerKey,
        amountCents: target,
        type: "refund",
        reason: "Points returned for a refunded order",
        sourceType: "redemption_refund",
        sourceId: redemption.id,
        idempotencyKey: `refund:${event.refundId}:redemption`,
      });
      out.returnedCents = r.appliedCents;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Spending: points -> single-use Shopify code
// ---------------------------------------------------------------------------------------------

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alikes

function generateCode() {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return `${CODE_PREFIX}${s}`;
}

export interface RedeemResult {
  id: string;
  code: string;
  amountCents: number;
  expiresAt: Date;
}

/**
 * Turns points into a single-use discount code for the same dollar amount. The points leave the
 * balance first (so they can't be spent twice); if creating the code in Shopify then fails, they
 * are put straight back.
 */
export async function redeemPoints(
  params: { email: string; amountCents: number },
  opts: ServiceOptions = {},
): Promise<RedeemResult> {
  const rules = await getWalletRules();
  if (!rules.enabled) throw new WalletError("Wallet points aren't available right now.", "disabled");
  if (!Number.isInteger(params.amountCents) || params.amountCents < rules.minRedeemCents) {
    throw new WalletError(
      `The smallest amount you can redeem is ${(rules.minRedeemCents / 100).toFixed(2)} points.`,
      "too_small",
    );
  }
  const member = await findActiveMember(params.email);
  if (!member) throw new WalletError("Only active members can redeem points.", "not_member");

  const account = await ensureWalletAccount("customer", params.email);
  const pending = await prisma.walletRedemption.count({ where: { accountId: account.id, status: "pending" } });
  if (pending >= MAX_PENDING_CODES) {
    throw new WalletError(`You already have ${MAX_PENDING_CODES} unused codes. Use one before creating another.`, "invalid");
  }

  const expiresAt = new Date(Date.now() + rules.redeemExpiryDays * 24 * 60 * 60 * 1000);
  let redemption = null;
  for (let attempt = 0; attempt < 3 && !redemption; attempt++) {
    try {
      redemption = await prisma.walletRedemption.create({
        data: { accountId: account.id, amountCents: params.amountCents, code: generateCode(), expiresAt },
      });
    } catch (e) {
      if (!(typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002")) throw e;
    }
  }
  if (!redemption) throw new WalletError("Could not create a code. Please try again.", "invalid");

  try {
    await debitWallet({
      kind: "customer",
      ownerKey: params.email,
      amountCents: params.amountCents,
      type: "redeem",
      reason: `Redeemed for code ${redemption.code}`,
      sourceType: "redemption",
      sourceId: redemption.id,
      idempotencyKey: `redemption:${redemption.id}:redeem`,
    });
  } catch (e) {
    await prisma.walletRedemption.delete({ where: { id: redemption.id } });
    throw e;
  }

  if (!opts.skipShopify) {
    try {
      await createDiscountCode({
        title: `Wallet points: ${params.email}`,
        code: redemption.code,
        valueType: "fixed_amount",
        value: params.amountCents / 100,
        usageLimit: 1,
        endsAt: expiresAt,
      });
    } catch (e) {
      await creditWallet({
        kind: "customer",
        ownerKey: params.email,
        amountCents: params.amountCents,
        type: "refund",
        reason: "Code could not be created, points returned",
        sourceType: "redemption",
        sourceId: redemption.id,
        idempotencyKey: `redemption:${redemption.id}:release`,
      });
      await prisma.walletRedemption.update({ where: { id: redemption.id }, data: { status: "expired" } });
      console.error("Wallet code creation failed", e);
      throw new WalletError("We couldn't create your code just now. Your points are safe; please try again.", "shopify");
    }
  }

  return { id: redemption.id, code: redemption.code, amountCents: redemption.amountCents, expiresAt };
}

/**
 * Daily housekeeping (called from the cron job): codes nobody used by their deadline are expired
 * and their points go back to the member.
 */
export async function processWalletRedemptions(opts: ServiceOptions = {}, now = new Date()) {
  const cutoff = new Date(now.getTime() - EXPIRY_GRACE_MS);
  const due = await prisma.walletRedemption.findMany({
    where: { status: "pending", expiresAt: { lt: cutoff } },
    include: { account: true },
  });

  let expired = 0;
  let pointsReturnedCents = 0;
  const errors: string[] = [];
  for (const r of due) {
    // Claim it first; if an "order paid" webhook just marked it used, the claim fails and we stop.
    const claim = await prisma.walletRedemption.updateMany({
      where: { id: r.id, status: "pending" },
      data: { status: "expired" },
    });
    if (claim.count === 0) continue;
    await creditWallet({
      kind: r.account.kind,
      ownerKey: r.account.ownerKey,
      amountCents: r.amountCents,
      type: "refund",
      reason: "Unused wallet code expired",
      sourceType: "redemption",
      sourceId: r.id,
      idempotencyKey: `redemption:${r.id}:release`,
    });
    expired += 1;
    pointsReturnedCents += r.amountCents;
    if (!opts.skipShopify) {
      try {
        await deleteDiscountCodeByString(r.code);
      } catch (e) {
        // The code also has an end date in Shopify, so it stops working on its own regardless.
        errors.push(`${r.code}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return { expired, pointsReturnedCents, errors };
}

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

/** A manual change by an admin, always with a reason, always on the ledger. Cannot go below zero. */
export async function adjustWallet(params: {
  email: string;
  amountCents: number;
  reason: string;
  adminEmail: string;
}) {
  const reason = params.reason.trim().slice(0, 200);
  if (!reason) throw new WalletError("Please give a reason for the adjustment.", "invalid");
  if (!Number.isInteger(params.amountCents) || params.amountCents === 0) {
    throw new WalletError("Enter an amount other than zero.", "invalid");
  }
  const base = {
    kind: "customer" as const,
    ownerKey: params.email,
    type: "adjustment" as const,
    reason,
    sourceType: "admin",
    createdBy: params.adminEmail,
  };
  return params.amountCents > 0
    ? creditWallet({ ...base, amountCents: params.amountCents })
    : debitWallet({ ...base, amountCents: -params.amountCents });
}
