import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reviewNotes = typeof body.reviewNotes === "string" ? body.reviewNotes.slice(0, 1000) : undefined;

  const signup = await prisma.salesRepSignup.findUnique({ where: { id } });
  if (!signup) {
    return NextResponse.json({ error: "Signup not found" }, { status: 404 });
  }
  if (signup.linkedAffiliateId) {
    return NextResponse.json(
      { error: "This signup was already approved and has an affiliate account." },
      { status: 409 },
    );
  }

  await prisma.salesRepSignup.update({ where: { id }, data: { status: "rejected", reviewNotes } });
  return NextResponse.json({ ok: true });
}
