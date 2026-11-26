import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";

// Approved affiliates an admin can pick as a sponsor / referrer when adding someone.
export async function GET() {
  const { error } = await requireAdminOrResponse();
  if (error) return error;
  const rows = await prisma.affiliate.findMany({
    where: { status: "approved" },
    select: { id: true, displayName: true, userEmail: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    sponsors: rows.map((r) => ({ id: r.id, label: `${r.displayName ?? r.userEmail} (${r.userEmail})` })),
  });
}
