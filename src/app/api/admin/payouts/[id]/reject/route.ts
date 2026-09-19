import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
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
    data: { status: "rejected", notes: body.notes },
  });

  await createNotification(payout.affiliateId, {
    type: "payout_rejected",
    title: "Payout request declined",
    body: body.notes
      ? `Your $${payout.amount.toFixed(2)} request was declined: ${body.notes}`
      : `Your $${payout.amount.toFixed(2)} request was declined. Contact us for details.`,
  });

  return NextResponse.json({ ok: true, payout });
}
