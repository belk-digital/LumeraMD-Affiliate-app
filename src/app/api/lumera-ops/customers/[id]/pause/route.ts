import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { MembershipError, pauseMembership } from "@/lib/membership/lifecycle";

// Admin pauses a membership: billing stops, the discount is withdrawn and the member is emailed.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  try {
    const result = await pauseMembership(id);
    return NextResponse.json({ ok: true, status: result.customer.status, warnings: result.warnings });
  } catch (err) {
    if (err instanceof MembershipError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Pausing a membership failed", err);
    return NextResponse.json({ error: "Could not pausing a membership." }, { status: 500 });
  }
}
