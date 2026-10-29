import { prisma } from "@/lib/prisma";
import type { AffiliatePayout, Prisma } from "@/generated/prisma/client";
import { updateAffiliateStats } from "@/lib/affiliates/stats";
import { createNotification } from "@/lib/notifications/create";
import {
  notifyPayoutApproved,
  notifyPayoutPaid,
  notifyPayoutRejected,
  notifyPayoutRequested,
} from "@/lib/email/notifications";

// Everything that changes a payout goes through here, so the affiliate's balance, the commissions
// the payout covers, and the emails and notifications always move together, and a payout can only
// change state in ways that make sense.

export class PayoutError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

type PayoutStatus = AffiliatePayout["status"];

const round2 = (n: number) => Math.round(n * 100) / 100;
const MAX_AMOUNT = 1_000_000;

/** Where each state may go. Paid and rejected payouts can only be reopened to pending first. */
const ALLOWED: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ["approved", "rejected", "paid"],
  approved: ["pending", "rejected", "paid"],
  paid: ["pending"],
  rejected: ["pending"],
};

const STATUSES: PayoutStatus[] = ["pending", "approved", "paid", "rejected"];

function parseAmount(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) {
    throw new PayoutError("Enter an amount greater than $0.", 400);
  }
  return round2(n);
}

function parseText(value: unknown, label: string, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new PayoutError(`${label} must be text.`, 400);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new PayoutError(`${label} is too long (${max} characters at most).`, 400);
  return trimmed || null;
}

/** An affiliate asks for a payout. The balance check and the new request happen under one lock, so two requests at once can't both spend the same money. */
export async function requestPayout(
  affiliateId: string,
  input: { amount: unknown; payoutMethod: unknown; payoutDetails?: unknown },
) {
  const amount = parseAmount(input.amount);
  const payoutMethod = parseText(input.payoutMethod, "Payout method", 80);
  if (!payoutMethod) throw new PayoutError("Choose how you want to be paid.", 400);
  const details = input.payoutDetails;
  if (details !== undefined && details !== null && (typeof details !== "object" || Array.isArray(details))) {
    throw new PayoutError("Payout details are not valid.", 400);
  }

  const { payout, affiliate } = await prisma.$transaction(
    async (tx) => {
      // One request per affiliate at a time. The lock is released when this transaction ends.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${affiliateId}))`;

      const affiliate = await tx.affiliate.findUnique({ where: { id: affiliateId } });
      if (!affiliate) throw new PayoutError("Affiliate not found.", 404);

      const open = await tx.affiliatePayout.aggregate({
        where: { affiliateId, status: { in: ["pending", "approved"] } },
        _sum: { amount: true },
      });
      const available = round2(affiliate.totalCommissionApproved - (open._sum.amount ?? 0));

      if (amount > available) {
        throw new PayoutError(`Requested amount exceeds available balance ($${Math.max(available, 0).toFixed(2)}).`, 400);
      }
      if (amount < affiliate.minimumPayoutThreshold) {
        throw new PayoutError(`Below minimum payout threshold ($${affiliate.minimumPayoutThreshold}).`, 400);
      }

      const claimed = await tx.affiliatePayout.findMany({
        where: { affiliateId, status: { in: ["pending", "approved", "paid"] } },
        select: { conversionIds: true },
      });
      const alreadyClaimed = new Set(claimed.flatMap((p) => p.conversionIds));
      const approved = await tx.affiliateConversion.findMany({
        where: { affiliateId, status: "approved" },
        select: { id: true },
      });

      const payout = await tx.affiliatePayout.create({
        data: {
          affiliateId,
          amount,
          payoutMethod,
          payoutDetails: (details ?? undefined) as Prisma.InputJsonValue | undefined,
          conversionIds: approved.map((c) => c.id).filter((id) => !alreadyClaimed.has(id)),
          status: "pending",
        },
      });
      return { payout, affiliate };
    },
    { timeout: 15_000 },
  );

  await notifyPayoutRequested(affiliate, amount).catch((err) => console.error("Payout request email failed", err));
  await createNotification(affiliateId, {
    type: "payout_requested",
    title: "Payout request submitted",
    body: `Your $${amount.toFixed(2)} request is awaiting review.`,
  });
  return payout;
}

/**
 * Changes a payout: its state, and/or its amount, method, reference or notes. A state change that
 * is already in effect (a double click) does nothing and sends nothing.
 */
export async function updatePayout(
  id: string,
  patch: { status?: unknown; amount?: unknown; payoutMethod?: unknown; transactionId?: unknown; notes?: unknown },
): Promise<{ payout: AffiliatePayout; changed: boolean }> {
  const current = await prisma.affiliatePayout.findUnique({ where: { id } });
  if (!current) throw new PayoutError("Payout not found.", 404);

  let target: PayoutStatus | null = null;
  if (patch.status !== undefined && patch.status !== "") {
    if (!STATUSES.includes(patch.status as PayoutStatus)) throw new PayoutError("That isn't a payout status.", 400);
    if (patch.status !== current.status) target = patch.status as PayoutStatus;
  }
  if (target && !ALLOWED[current.status].includes(target)) {
    throw new PayoutError(
      current.status === "paid" || current.status === "rejected"
        ? `A ${current.status} payout can't be set to ${target}. Reopen it to pending first.`
        : `A ${current.status} payout can't be set to ${target}.`,
      409,
    );
  }

  const data: Prisma.AffiliatePayoutUpdateManyMutationInput = {};
  if (patch.amount !== undefined && patch.amount !== "") {
    const amount = parseAmount(patch.amount);
    if (amount !== current.amount) {
      if (current.status === "paid" || current.status === "rejected") {
        throw new PayoutError(`The amount of a ${current.status} payout can't be changed. Reopen it to pending first.`, 409);
      }
      data.amount = amount;
    }
  }
  if (patch.payoutMethod !== undefined) {
    const method = parseText(patch.payoutMethod, "Payout method", 80);
    if (method !== current.payoutMethod) data.payoutMethod = method;
  }
  if (patch.transactionId !== undefined) {
    const ref = parseText(patch.transactionId, "Reference", 120);
    if (ref !== current.transactionId) data.transactionId = ref;
  }
  if (patch.notes !== undefined) {
    const notes = parseText(patch.notes, "Notes", 1000);
    if (notes !== current.notes) data.notes = notes;
  }
  if (target) data.status = target;
  if (Object.keys(data).length === 0) return { payout: current, changed: false };

  // Only if nobody changed it since we read it: this is what stops a double click acting twice.
  const done = await prisma.affiliatePayout.updateMany({ where: { id, status: current.status }, data });
  if (done.count === 0) {
    const latest = await prisma.affiliatePayout.findUnique({ where: { id } });
    if (!latest) throw new PayoutError("Payout not found.", 404);
    if (target && latest.status === target) return { payout: latest, changed: false };
    throw new PayoutError("This payout was just changed by someone else. Refresh the page and try again.", 409);
  }

  const payout = await prisma.affiliatePayout.findUniqueOrThrow({ where: { id } });
  if (target) await afterTransition(current.status, payout);
  return { payout, changed: true };
}

async function afterTransition(from: PayoutStatus, payout: AffiliatePayout) {
  const safely = (label: string) => (err: unknown) => console.error(`${label} failed`, err);

  if (payout.status === "paid") {
    if (payout.conversionIds.length > 0) {
      await prisma.affiliateConversion.updateMany({
        where: { id: { in: payout.conversionIds }, status: "approved" },
        data: { status: "paid" },
      });
    }
    await updateAffiliateStats(payout.affiliateId);
    await createNotification(payout.affiliateId, {
      type: "payout_paid",
      title: `$${payout.amount.toFixed(2)} paid out`,
      body: `Sent via ${payout.payoutMethod ?? "your chosen method"}${payout.transactionId ? ` (ref ${payout.transactionId})` : ""}.`,
    });
    await notifyPayoutPaid(payout).catch(safely("Payout paid email"));
  } else if (payout.status === "approved") {
    await createNotification(payout.affiliateId, {
      type: "payout_approved",
      title: "Payout approved",
      body: `Your $${payout.amount.toFixed(2)} payout request was approved and will be sent soon.`,
    });
    await notifyPayoutApproved(payout).catch(safely("Payout approved email"));
  } else if (payout.status === "rejected") {
    await createNotification(payout.affiliateId, {
      type: "payout_rejected",
      title: "Payout request declined",
      body: payout.notes
        ? `Your $${payout.amount.toFixed(2)} request was declined: ${payout.notes}`
        : `Your $${payout.amount.toFixed(2)} request was declined. Contact us for details.`,
    });
    await notifyPayoutRejected(payout).catch(safely("Payout rejected email"));
  } else if (payout.status === "pending" && from === "paid") {
    // Reopened after being marked paid: the money counts as unpaid again, quietly (an admin correction).
    if (payout.conversionIds.length > 0) {
      await prisma.affiliateConversion.updateMany({
        where: { id: { in: payout.conversionIds }, status: "paid" },
        data: { status: "approved" },
      });
    }
    await updateAffiliateStats(payout.affiliateId);
  }
}

/** An admin records a payment made outside the system. It counts as paid straight away. */
export async function createManualPayout(input: {
  affiliateId: unknown;
  amount: unknown;
  payoutMethod?: unknown;
  notes?: unknown;
}) {
  if (typeof input.affiliateId !== "string" || !input.affiliateId) throw new PayoutError("Choose an affiliate.", 400);
  const amount = parseAmount(input.amount);
  const payoutMethod = parseText(input.payoutMethod, "Payout method", 80) ?? "Manual";
  const notes = parseText(input.notes, "Notes", 1000);

  const affiliate = await prisma.affiliate.findUnique({ where: { id: input.affiliateId }, select: { id: true } });
  if (!affiliate) throw new PayoutError("Affiliate not found.", 404);

  const payout = await prisma.affiliatePayout.create({
    data: { affiliateId: affiliate.id, amount, payoutMethod, notes, status: "paid" },
  });
  // Without this the affiliate's available balance wouldn't drop, and they could request the same money again.
  await updateAffiliateStats(affiliate.id);
  return payout;
}
