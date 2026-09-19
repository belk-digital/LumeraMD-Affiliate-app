import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { updateAffiliateStats } from "@/lib/affiliates/stats";
import { createNotification } from "@/lib/notifications/create";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const payout = await prisma.affiliatePayout.update({
    where: { id },
    data: { status: "paid", transactionId: body.transactionId },
  });

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

  return NextResponse.json({ ok: true, payout });
}
