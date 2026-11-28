import { NextRequest, NextResponse } from "next/server";
import { getCatalog } from "@/lib/membership/plans.server";
import { prisma } from "@/lib/prisma";
import { requirePortalKey } from "@/lib/portal/auth";
import { portalMember } from "@/lib/portal/member";

// GET /api/v1/members/{id}: one member by their id. See docs/portal-integration.md.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePortalKey(req);
  if (denied) return denied;

  const { id } = await params;
  const row = await prisma.customerSignup.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ member: portalMember(row, new Date(), (await getCatalog()).plans) }, { headers: { "Cache-Control": "no-store" } });
}
