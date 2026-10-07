import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { MembershipError, grantComplimentary } from "@/lib/membership/lifecycle";

// Admin onboards someone without payment or billing. The note (who and why) is required and kept
// on the membership. Until a payment provider exists this is the "I know them" bypass.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note : "";

  try {
    const result = await grantComplimentary(id, { note, adminEmail: session.email });
    return NextResponse.json({ ok: true, warnings: result.warnings });
  } catch (err) {
    if (err instanceof MembershipError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Granting complimentary membership failed", err);
    return NextResponse.json({ error: "Could not grant access." }, { status: 500 });
  }
}
