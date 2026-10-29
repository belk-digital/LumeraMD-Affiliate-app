import { NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { updatePayout } from "@/lib/payouts/service";
import { payoutErrorResponse } from "@/lib/payouts/respond";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  try {
    const { payout } = await updatePayout(id, { status: "approved" });
    return NextResponse.json({ ok: true, payout });
  } catch (err) {
    return payoutErrorResponse(err);
  }
}
