import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { updateAffiliateStats } from "@/lib/affiliates/stats";
import { createNotification } from "@/lib/notifications/create";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminOrResponse();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const conversion = await prisma.affiliateConversion.update({
    where: { id },
    data: {
      status: "reversed",
      reversedReason: body.reason ?? "Manually reversed by admin",
    },
  });

  await updateAffiliateStats(conversion.affiliateId);
  if (conversion.parentAffiliateId) {
    await updateAffiliateStats(conversion.parentAffiliateId);
  }

  await createNotification(conversion.affiliateId, {
    type: "commission_reversed",
    title: `Commission reversed: $${conversion.commissionAmount.toFixed(2)}`,
    body: `Order ${conversion.shopifyOrderName ?? ""} was reversed.`.trim(),
  });

  return NextResponse.json({ ok: true, conversion });
}
