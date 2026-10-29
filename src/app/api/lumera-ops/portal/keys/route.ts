import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { createPortalApiKey } from "@/lib/portal/keys";

const MAX_LIVE_KEYS = 10;

/** Creates an API key. The key itself is in this response and nowhere else: it can't be shown again. */
export async function POST(req: NextRequest) {
  const { session, error } = await requireAdminOrResponse();
  if (error) return error;

  const { name } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Give the key a name, such as the company or system it is for." }, { status: 400 });
  }
  const live = await prisma.portalApiKey.count({ where: { revokedAt: null } });
  if (live >= MAX_LIVE_KEYS) {
    return NextResponse.json({ error: `There are already ${MAX_LIVE_KEYS} active keys. Revoke one you no longer use first.` }, { status: 409 });
  }

  const { record, token } = await createPortalApiKey(name, session?.email);
  return NextResponse.json({
    key: token,
    record: { id: record.id, name: record.name, prefix: record.prefix },
  });
}
