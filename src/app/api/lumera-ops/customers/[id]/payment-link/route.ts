import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { MembershipError, sendPaymentLink } from "@/lib/membership/lifecycle";

// Admin emails a member their payment link.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  try {
    const { link } = await sendPaymentLink(id);
    return NextResponse.json({ ok: true, link });
  } catch (err) {
    if (err instanceof MembershipError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Sending payment link failed", err);
    return NextResponse.json({ error: "Could not send the payment link." }, { status: 500 });
  }
}
