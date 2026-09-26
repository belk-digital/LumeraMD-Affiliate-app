import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { notifyApplicationRejected } from "@/lib/email/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const application = await prisma.affiliateApplication.update({
    where: { id },
    data: { status: "rejected", reviewNotes: body.reviewNotes },
  });

  await notifyApplicationRejected(application);

  return NextResponse.json({ ok: true, application });
}
