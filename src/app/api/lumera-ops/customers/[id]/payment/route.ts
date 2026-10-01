import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { MembershipError, recordMembershipPayment } from "@/lib/membership/lifecycle";

// Records a payment taken outside the platform (cash, invoice, a card terminal). A payment
// provider integration will call recordMembershipPayment directly from its webhook instead.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : undefined;

  try {
    const result = await recordMembershipPayment({
      customerId: id,
      amount,
      source: "manual",
      note: note || undefined,
    });
    return NextResponse.json({ ok: true, warnings: result.warnings });
  } catch (err) {
    if (err instanceof MembershipError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Recording membership payment failed", err);
    return NextResponse.json({ error: "Could not record the payment." }, { status: 500 });
  }
}
