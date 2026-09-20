import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const { status, amount, payoutMethod, transactionId } = body;

    const data: any = {};
    if (status) data.status = status;
    if (amount !== undefined) data.amount = parseFloat(amount);
    if (payoutMethod !== undefined) data.payoutMethod = payoutMethod;
    if (transactionId !== undefined) data.transactionId = transactionId;

    const payout = await prisma.affiliatePayout.update({
      where: { id },
      data,
    });

    return NextResponse.json(payout);
  } catch (error: any) {
    console.error("PATCH /api/admin/payouts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update payout" },
      { status: 500 }
    );
  }
}
