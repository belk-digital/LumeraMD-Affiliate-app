import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { MoveError, moveAffiliate } from "@/lib/affiliates/reassign";

/** Re-parents an affiliate (and their team) under another affiliate, or to the top level. See moveAffiliate. */
export async function POST(req: NextRequest) {
  const { session, error } = await requireAdminOrResponse();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const parentId = typeof body?.parentId === "string" && body.parentId ? body.parentId : null;
  if (!id) return NextResponse.json({ error: "Missing affiliate." }, { status: 400 });

  try {
    const result = await moveAffiliate({ id, parentId, adminEmail: session?.email ?? "admin" });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof MoveError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Move failed", err);
    return NextResponse.json({ error: "Could not move this affiliate." }, { status: 500 });
  }
}
