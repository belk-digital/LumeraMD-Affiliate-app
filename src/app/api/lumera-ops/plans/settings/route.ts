import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { parseTestKitPrice } from "@/lib/membership/planInput";

// The standard DNA test kit price (what members pay when their plan has no lower test kit price).
export async function PUT(req: NextRequest) {
  const { session, error } = await requireAdminOrResponse();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const testKitPrice = parseTestKitPrice(body?.testKitPrice);
  if (testKitPrice === null) {
    return NextResponse.json({ error: "The test kit price must be between $1 and $100,000." }, { status: 400 });
  }
  await prisma.membershipSettings.upsert({
    where: { id: "global" },
    create: { id: "global", testKitPrice, updatedBy: session.email },
    update: { testKitPrice, updatedBy: session.email },
  });
  return NextResponse.json({ ok: true });
}
