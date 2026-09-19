import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";

/** Per-affiliate terms an admin can change after approval. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  // Blank / null clears the per-affiliate rate so the program default applies.
  const blank = b.parentOverrideRate === "" || b.parentOverrideRate === null;
  const rate = blank ? null : Number(b.parentOverrideRate);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
    return NextResponse.json(
      { error: "Team override must be between 0 and 100, or blank to use the default" },
      { status: 400 },
    );
  }

  const existing = await prisma.affiliate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });

  // Applies to future orders only: each conversion stores the rate it was calculated at.
  const affiliate = await prisma.affiliate.update({
    where: { id },
    data: { parentOverrideRate: rate === null ? null : Math.round(rate * 100) / 100 },
    select: { id: true, parentOverrideRate: true },
  });

  return NextResponse.json({ ok: true, affiliate });
}
