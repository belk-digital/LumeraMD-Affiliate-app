import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAffiliateSession } from "@/lib/affiliates/session";

const PAYOUT_METHODS = ["zelle", "cashapp", "paypal"];

export async function PATCH(req: NextRequest) {
  const session = await getAffiliateSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const data: {
    displayName?: string | null;
    payoutMethod?: string | null;
    payoutDetails?: { destination: string };
    emailNotifications?: boolean;
    referralSlug?: string;
    shopifyDiscountCode?: string | null;
  } = {};

  if ("displayName" in body) {
    const name = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (name.length > 80) {
      return NextResponse.json({ error: "Name must be 80 characters or fewer" }, { status: 400 });
    }
    data.displayName = name || null;
  }

  if ("payoutMethod" in body) {
    if (body.payoutMethod && !PAYOUT_METHODS.includes(body.payoutMethod)) {
      return NextResponse.json({ error: "Unsupported payout method" }, { status: 400 });
    }
    data.payoutMethod = body.payoutMethod || null;
  }

  if ("payoutDestination" in body) {
    const destination =
      typeof body.payoutDestination === "string" ? body.payoutDestination.trim() : "";
    if (destination.length > 200) {
      return NextResponse.json({ error: "Payout destination is too long" }, { status: 400 });
    }
    data.payoutDetails = { destination };
  }

  if ("emailNotifications" in body) {
    if (typeof body.emailNotifications !== "boolean") {
      return NextResponse.json({ error: "Invalid value" }, { status: 400 });
    }
    data.emailNotifications = body.emailNotifications;
  }

  if ("referralSlug" in body) {
    const slug = typeof body.referralSlug === "string" ? body.referralSlug.trim() : "";
    if (!slug) {
      return NextResponse.json({ error: "Referral slug is required" }, { status: 400 });
    }
    // Check uniqueness
    const existing = await prisma.affiliate.findFirst({
      where: { referralSlug: slug, id: { not: session.affiliateId } },
    });
    if (existing) {
      return NextResponse.json({ error: "Referral slug is already taken" }, { status: 400 });
    }
    data.referralSlug = slug;
  }

  if ("shopifyDiscountCode" in body) {
    const code = typeof body.shopifyDiscountCode === "string" ? body.shopifyDiscountCode.trim() : "";
    if (code) {
      const existing = await prisma.affiliate.findFirst({
        where: { shopifyDiscountCode: code, id: { not: session.affiliateId } },
      });
      if (existing) {
        return NextResponse.json({ error: "Discount code is already taken" }, { status: 400 });
      }
    }
    data.shopifyDiscountCode = code || null;
  }

  // Fetch existing affiliate to compare old vs new code
  const existingAffiliate = await prisma.affiliate.findUnique({
    where: { id: session.affiliateId }
  });

  if (!existingAffiliate) {
    return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
  }

  const oldCode = existingAffiliate.shopifyDiscountCode;
  const newCode = data.shopifyDiscountCode !== undefined ? data.shopifyDiscountCode : oldCode;
  
  if (newCode !== oldCode && newCode) {
    try {
      const { createDiscountCode, deleteDiscountCodeByString } = await import("@/lib/shopify/client");
      
      if (oldCode) {
        try {
          await deleteDiscountCodeByString(oldCode);
        } catch (e) {
          console.error("Failed to delete old Shopify discount code", e);
        }
      }

      await createDiscountCode({
        title: `Affiliate: ${data.displayName || existingAffiliate.displayName}`,
        code: newCode,
        valueType: "percentage",
        value: existingAffiliate.shopifyDiscountValue, // Affiliate cannot change their own discount value
      });
    } catch (e: any) {
      console.error("Failed to sync with Shopify:", e);
      // Optional: you could block the save if Shopify sync fails
      // return NextResponse.json({ error: "Failed to create discount code in Shopify" }, { status: 500 });
    }
  }

  const affiliate = await prisma.affiliate.update({
    where: { id: session.affiliateId },
    data,
  });

  return NextResponse.json({
    ok: true,
    affiliate: {
      displayName: affiliate.displayName,
      payoutMethod: affiliate.payoutMethod,
      emailNotifications: affiliate.emailNotifications,
      referralSlug: affiliate.referralSlug,
      shopifyDiscountCode: affiliate.shopifyDiscountCode,
    },
  });
}
