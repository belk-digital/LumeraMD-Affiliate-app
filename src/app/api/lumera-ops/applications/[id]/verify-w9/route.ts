import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  const application = await prisma.affiliateApplication.findUnique({
    where: { id },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (!application.w9FileName) {
    return NextResponse.json({ error: "This application has no W-9 to verify." }, { status: 400 });
  }

  const updated = await prisma.affiliateApplication.update({
    where: { id },
    data: { w9VerifiedAt: new Date(), w9VerifiedBy: session!.email },
  });

  return NextResponse.json({ ok: true, application: updated });
}
