import { NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { updatePayout } from "@/lib/payouts/service";
import { payoutErrorResponse } from "@/lib/payouts/respond";

/** The admin Payouts page: a status change from the menu, or the Edit form. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const { payout } = await updatePayout(id, {
      status: body.status,
      amount: body.amount,
      payoutMethod: body.payoutMethod,
      transactionId: body.transactionId,
      notes: body.notes,
    });
    return NextResponse.json(payout);
  } catch (err) {
    return payoutErrorResponse(err);
  }
}
