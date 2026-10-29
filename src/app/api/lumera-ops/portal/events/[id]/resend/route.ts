import { NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { resendPortalEvent } from "@/lib/portal/events";

/** "Send again": one more delivery attempt for a stored notification. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  const event = await resendPortalEvent(id);
  if (!event) {
    return NextResponse.json({ error: "That notification doesn't exist, or the portal isn't configured." }, { status: 404 });
  }
  return NextResponse.json({
    event: { status: event.status, attempts: event.attempts, lastError: event.lastError, deliveredAt: event.deliveredAt },
  });
}
