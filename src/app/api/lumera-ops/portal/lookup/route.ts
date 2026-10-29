import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { portalMember } from "@/lib/portal/member";

/** "Try a lookup": exactly what the portal would get for this email, without needing an API key. */
export async function POST(req: NextRequest) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a full email address." }, { status: 400 });
  }
  // Same rule as the portal API: the newest membership that isn't cancelled, else the newest one.
  const rows = await prisma.customerSignup.findMany({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  const row = rows.find((r) => r.status !== "cancelled") ?? rows[0];
  if (!row) return NextResponse.json({ error: "No member with that email." }, { status: 404 });
  return NextResponse.json({ member: portalMember(row) });
}
