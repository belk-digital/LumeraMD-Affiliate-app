import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { MembershipError, activateMembership } from "@/lib/membership/lifecycle";

// Admin switches a paused membership back on and the member is emailed.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  try {
    const result = await activateMembership(id);
    return NextResponse.json({ ok: true, status: result.customer.status, warnings: result.warnings });
  } catch (err) {
    if (err instanceof MembershipError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Activating a membership failed", err);
    return NextResponse.json({ error: "Could not activating a membership." }, { status: 500 });
  }
}
