import { NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { revokePortalApiKey } from "@/lib/portal/keys";

/** Revokes a key: anything still using it is refused from the next request on. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  if (!(await revokePortalApiKey(id))) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
