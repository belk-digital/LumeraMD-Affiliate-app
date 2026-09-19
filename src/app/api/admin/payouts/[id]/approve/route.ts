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
  const payout = await prisma.affiliatePayout.update({
    where: { id },
    data: { status: "approved" },
  });

  await createNotification(payout.affiliateId, {
    type: "payout_approved",
    title: "Payout approved",
    body: `Your $${payout.amount.toFixed(2)} payout request was approved and will be sent soon.`,
  });

  return NextResponse.json({ ok: true, payout });
}
