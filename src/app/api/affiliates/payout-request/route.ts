import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { notifyPayoutRequested } from "@/lib/email/notifications";
import { getAffiliateSession } from "@/lib/affiliates/session";
import { createNotification } from "@/lib/notifications/create";

export async function POST(req: NextRequest) {
  const session = await getAffiliateSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const affiliateId = session.affiliateId;

  const body = await req.json();
  const { amount, payoutMethod, payoutDetails } = body as {
    amount: number;
    payoutMethod: string;
    payoutDetails?: Record<string, unknown>;
  };

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
  });
  if (!affiliate) {
    return NextResponse.json({ error: "affiliate not found" }, { status: 404 });
  }

  const alreadyRequested = await prisma.affiliatePayout.aggregate({
    where: { affiliateId, status: { in: ["pending", "approved"] } },
    _sum: { amount: true },
  });

  const available =
    affiliate.totalCommissionApproved - (alreadyRequested._sum.amount ?? 0);

  if (amount > available) {
    return NextResponse.json(
      { error: `Requested amount exceeds available balance ($${available.toFixed(2)})` },
      { status: 400 },
    );
  }

  if (amount < affiliate.minimumPayoutThreshold) {
    return NextResponse.json(
      { error: `Below minimum payout threshold ($${affiliate.minimumPayoutThreshold})` },
      { status: 400 },
    );
  }

  const priorPayouts = await prisma.affiliatePayout.findMany({
    where: { affiliateId, status: { in: ["pending", "approved", "paid"] } },
    select: { conversionIds: true },
  });
  const alreadyClaimed = new Set(priorPayouts.flatMap((p) => p.conversionIds));

  const approvedConversions = await prisma.affiliateConversion.findMany({
    where: { affiliateId, status: "approved" },
    select: { id: true },
  });
  const unclaimedConversionIds = approvedConversions
    .map((c) => c.id)
    .filter((id) => !alreadyClaimed.has(id));

  const payout = await prisma.affiliatePayout.create({
    data: {
      affiliateId,
      amount,
      payoutMethod,
      payoutDetails: payoutDetails as Prisma.InputJsonValue | undefined,
      conversionIds: unclaimedConversionIds,
      status: "pending",
    },
  });

  await notifyPayoutRequested(affiliate, amount);
  await createNotification(affiliateId, {
    type: "payout_requested",
    title: "Payout request submitted",
    body: `Your $${amount.toFixed(2)} request is awaiting review.`,
  });

  return NextResponse.json({ ok: true, payout });
}
