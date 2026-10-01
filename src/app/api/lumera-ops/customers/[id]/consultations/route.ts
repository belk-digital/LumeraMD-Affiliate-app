import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { adjustConsultationsUsed, MembershipError } from "@/lib/membership/lifecycle";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.delta !== 1 && body.delta !== -1) {
    return NextResponse.json({ error: "delta must be 1 or -1" }, { status: 400 });
  }

  try {
    const customer = await adjustConsultationsUsed(id, body.delta);
    return NextResponse.json({ ok: true, consultationsUsed: customer.consultationsUsed });
  } catch (err) {
    if (err instanceof MembershipError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Adjusting consultations failed", err);
    return NextResponse.json({ error: "Could not update consultations." }, { status: 500 });
  }
}
