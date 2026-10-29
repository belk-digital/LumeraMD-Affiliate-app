import { NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { createManualPayout } from "@/lib/payouts/service";
import { payoutErrorResponse } from "@/lib/payouts/respond";

/** Records a payment made outside the system. It counts as paid straight away. */
export async function POST(request: Request) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const payout = await createManualPayout({
      affiliateId: body.affiliateId,
      amount: body.amount,
      payoutMethod: body.payoutMethod,
      notes: body.notes,
    });
    return NextResponse.json(payout);
  } catch (err) {
    return payoutErrorResponse(err);
  }
}
