import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const { isSuspicious } = body;

    const data: any = {};
    if (isSuspicious !== undefined) data.isSuspicious = isSuspicious;

    const click = await prisma.affiliateClick.update({
      where: { id },
      data,
    });

    return NextResponse.json(click);
  } catch (error: any) {
    console.error("PATCH /api/admin/clicks/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update click" },
      { status: 500 }
    );
  }
}
