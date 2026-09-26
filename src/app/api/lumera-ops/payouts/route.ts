import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";

export async function POST(request: Request) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  try {
    const body = await request.json();
    const { affiliateId, amount, payoutMethod, notes } = body;

    if (!affiliateId || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const payout = await prisma.affiliatePayout.create({
      data: {
        affiliateId,
        amount: parseFloat(amount),
        payoutMethod: payoutMethod || "Manual",
        notes,
        status: "paid", // default to paid for manual payouts, can be overridden by admin later
      },
    });

    return NextResponse.json(payout);
  } catch (error: any) {
    console.error("POST /api/lumera-ops/payouts error:", error);
    return NextResponse.json(
      { error: "Failed to create manual payout" },
      { status: 500 }
    );
  }
}
