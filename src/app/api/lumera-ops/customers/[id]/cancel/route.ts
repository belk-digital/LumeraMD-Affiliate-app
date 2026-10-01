import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { cancelMembership, MembershipError } from "@/lib/membership/lifecycle";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  try {
    const result = await cancelMembership(id);
    return NextResponse.json({ ok: true, warnings: result.warnings });
  } catch (err) {
    if (err instanceof MembershipError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Cancelling membership failed", err);
    return NextResponse.json({ error: "Could not cancel this membership." }, { status: 500 });
  }
}
