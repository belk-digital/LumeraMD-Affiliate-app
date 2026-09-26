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

  const updateData: Record<string, any> = {};
  
  if ("parentOverrideRate" in b) {
    const blank = b.parentOverrideRate === "" || b.parentOverrideRate === null;
    const rate = blank ? null : Number(b.parentOverrideRate);
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
      return NextResponse.json(
        { error: "Team override must be between 0 and 100, or blank to use the default" },
        { status: 400 },
      );
    }
    updateData.parentOverrideRate = rate === null ? null : Math.round(rate * 100) / 100;
  }
  
  if ("status" in b) {
    updateData.status = b.status;
  }
  
  if ("suspendReason" in b) {
    updateData.suspendReason = b.suspendReason || null;
  }

  if ("fraudNotes" in b) {
    updateData.fraudNotes = b.fraudNotes || null;
  }
  
  if ("userEmail" in b) {
    updateData.userEmail = b.userEmail;
  }
  
  if ("displayName" in b) {
    updateData.displayName = b.displayName || null;
  }
  
  if ("referralSlug" in b) {
    updateData.referralSlug = b.referralSlug;
  }
  if ("shopifyDiscountCode" in b) {
    updateData.shopifyDiscountCode = b.shopifyDiscountCode;
  }
  if ("shopifyDiscountValue" in b) {
    updateData.shopifyDiscountValue = b.shopifyDiscountValue;
  }

  if ("commissionRate" in b) {
    const rate = Number(b.commissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return NextResponse.json({ error: "Commission rate must be between 0 and 100" }, { status: 400 });
    }
    updateData.commissionRate = Math.round(rate * 100) / 100;
  }
  
  if ("cookieDurationDays" in b) {
    const days = Number(b.cookieDurationDays);
    if (!Number.isInteger(days) || days < 0) {
      return NextResponse.json({ error: "Cookie duration must be a positive integer" }, { status: 400 });
    }
    updateData.cookieDurationDays = days;
  }

  if ("minimumPayoutThreshold" in b) {
    const min = Number(b.minimumPayoutThreshold);
    if (!Number.isFinite(min) || min < 0) {
      return NextResponse.json({ error: "Minimum payout amount must be a positive number" }, { status: 400 });
    }
    updateData.minimumPayoutThreshold = Math.round(min * 100) / 100;
  }

  if ("payoutMethod" in b) {
    updateData.payoutMethod = b.payoutMethod || null;
  }

  const existing = await prisma.affiliate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });

  const oldCode = existing.shopifyDiscountCode;
  const newCode = updateData.shopifyDiscountCode !== undefined ? updateData.shopifyDiscountCode : oldCode;
  const oldVal = existing.shopifyDiscountValue;
  const newVal = updateData.shopifyDiscountValue !== undefined ? updateData.shopifyDiscountValue : oldVal;

  const codeChanged = newCode !== oldCode;
  const valChanged = newVal !== oldVal;

  try {
    if ((codeChanged || valChanged) && newCode) {
      const { createDiscountCode, deleteDiscountCodeByString } = await import("@/lib/shopify/client");
      
      // If there was an old code, try deleting it to prevent duplicates or clean up
      if (oldCode) {
        try {
          await deleteDiscountCodeByString(oldCode);
        } catch (e) {
          console.error("Failed to delete old Shopify discount code", e);
        }
      }

      // Recreate the code with new value
      await createDiscountCode({
        title: `Affiliate: ${updateData.displayName || existing.displayName}`,
        code: newCode,
        valueType: "percentage",
        value: newVal,
      });
    }

    const affiliate = await prisma.affiliate.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ ok: true, affiliate });
  } catch (err: any) {
    console.error("Failed to update affiliate:", err);
    return NextResponse.json({ error: err.message || "Failed to update affiliate" }, { status: 500 });
  }
}
