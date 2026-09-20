import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";

function createReferralSlug(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6);
  return `${base}-${randomStr}`;
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  try {
    const body = await req.json();
    const { email, displayName, status } = body;

    if (!email || !displayName) {
      return NextResponse.json({ error: "Email and Display Name are required" }, { status: 400 });
    }

    const existing = await prisma.affiliate.findUnique({
      where: { userEmail: email }
    });

    if (existing) {
      return NextResponse.json({ error: "Affiliate with this email already exists" }, { status: 400 });
    }

    const referralSlug = createReferralSlug(displayName);
    const shopifyDiscountCode = referralSlug.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const newAffiliate = await prisma.affiliate.create({
      data: {
        userEmail: email,
        displayName: displayName,
        status: status || 'approved',
        referralSlug: referralSlug,
        shopifyDiscountCode: shopifyDiscountCode,
      }
    });

    return NextResponse.json({ ok: true, affiliate: newAffiliate });
  } catch (err: any) {
    console.error("Failed to create affiliate:", err);
    return NextResponse.json({ error: err.message || "Failed to create affiliate" }, { status: 500 });
  }
}
