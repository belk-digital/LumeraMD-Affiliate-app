import { NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { sendPortalTestPing } from "@/lib/portal/events";

/** Sends the portal a signed test notification and reports how it went. */
export async function POST() {
  const { error } = await requireAdminOrResponse();
  if (error) return error;
  return NextResponse.json(await sendPortalTestPing());
}
