import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { defaultOverrideEligible, parsePlanInput, parsePlanKey } from "@/lib/membership/planInput";

// Customize one membership package. New signups and new payments use the saved values; members who already
// pay keep the monthly price they signed up at.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { session, error } = await requireAdminOrResponse();
  if (error) return error;

  const key = parsePlanKey((await params).key);
  if (!key) return NextResponse.json({ error: "Unknown plan." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = parsePlanInput(body && typeof body === "object" ? (body as Record<string, unknown>) : {});
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const data = { ...parsed.value, overrideEligible: defaultOverrideEligible(key), updatedBy: session.email };
  await prisma.membershipPlanConfig.upsert({ where: { key }, create: { key, ...data }, update: data });
  return NextResponse.json({ ok: true });
}

// Put a plan back to the built-in defaults.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const key = parsePlanKey((await params).key);
  if (!key) return NextResponse.json({ error: "Unknown plan." }, { status: 404 });
  await prisma.membershipPlanConfig.deleteMany({ where: { key } });
  return NextResponse.json({ ok: true });
}
