import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { AddError, adminAdd, parseAddInput } from "@/lib/membership/adminAdd";

// Admin adds a member or a sales rep by hand, paid (recurring) or free (complimentary).
export async function POST(req: NextRequest) {
  const { session, error } = await requireAdminOrResponse();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid submission." }, { status: 400 });

  try {
    const result = await adminAdd(parseAddInput(body as Record<string, unknown>, session.email));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AddError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Admin add failed", err);
    return NextResponse.json({ error: "Could not add this person." }, { status: 500 });
  }
}
