import { prisma } from "@/lib/prisma";
import type { Affiliate, Prisma } from "@/generated/prisma/client";
import { createDiscountCode } from "@/lib/shopify/client";
import { notifyAffiliateApproved } from "@/lib/email/notifications";
import { createNotification } from "@/lib/notifications/create";
import { startCycleIfEnabled } from "@/lib/affiliates/activity";

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "affiliate"}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Creates an approved affiliate with the program defaults, a Shopify discount code and the welcome
 * notifications. Shared by the affiliate application flow and the sales rep signup flow.
 *
 * `afterCreate` runs in the same database transaction as the affiliate insert, so the caller can
 * link its own record to the new affiliate atomically: if the link fails, the affiliate is rolled
 * back too, instead of being left behind and blocking every retry as "already an affiliate".
 * Emails and notifications only go out after the transaction commits.
 */
export async function provisionAffiliate(params: {
  email: string;
  displayName: string;
  parentAffiliateId: string | null;
  afterCreate?: (affiliate: Affiliate, tx: Prisma.TransactionClient) => Promise<void>;
  /** Skip creating the Shopify discount code (used by tests so they don't touch the live store). */
  skipShopifyDiscount?: boolean;
}) {
  const { email, displayName, parentAffiliateId } = params;

  const settings = await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });

  // A recruiter an admin has switched off can't gain new team members, even from a signup that was
  // submitted through their link before the switch.
  let parentId = parentAffiliateId;
  if (parentId) {
    const parent = await prisma.affiliate.findUnique({
      where: { id: parentId },
      select: { canRecruit: true },
    });
    if (!parent || !parent.canRecruit) parentId = null;
  }

  const slug = slugify(displayName);
  const discountCode = slug.toUpperCase().replace(/-/g, "");

  if (!params.skipShopifyDiscount) {
    await createDiscountCode({
      title: `Affiliate: ${displayName}`,
      code: discountCode,
      valueType: "percentage",
      value: 10,
    });
  }

  const affiliate = await prisma.$transaction(async (tx) => {
    const created = await tx.affiliate.create({
      data: {
        userEmail: email,
        displayName,
        status: "approved",
        referralSlug: slug,
        shopifyDiscountCode: params.skipShopifyDiscount ? null : discountCode,
        commissionRate: settings.defaultCommissionRate,
        commissionType: settings.defaultCommissionType,
        commissionOn: settings.defaultCommissionOn,
        cookieDurationDays: settings.defaultCookieDurationDays,
        pendingPeriodDays: settings.defaultPendingPeriodDays,
        minimumPayoutThreshold: settings.defaultMinimumPayoutThreshold,
        parentAffiliateId: parentId,
        canRecruit: settings.defaultCanRecruit,
      },
    });
    await params.afterCreate?.(created, tx);
    return created;
  });

  await notifyAffiliateApproved(affiliate);

  // Begins their 90-day activity cycle when that program is on. Never blocks approval.
  try {
    await startCycleIfEnabled(affiliate.id);
  } catch (err) {
    console.error("Could not start the activity cycle", err);
  }

  await createNotification(affiliate.id, {
    type: "welcome",
    title: "Welcome to the affiliate program!",
    body: "Your application was approved. Share your link, code or QR to start earning.",
  });
  if (affiliate.parentAffiliateId) {
    await createNotification(affiliate.parentAffiliateId, {
      type: "recruit_joined",
      title: "Someone you referred just joined",
      body: `${displayName} is now on your team.`,
    });
  }

  return affiliate;
}

export async function createAffiliateFromApplication(applicationId: string) {
  const application = await prisma.affiliateApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw new Error("Application not found");
  if (application.linkedAffiliateId) {
    return prisma.affiliate.findUnique({
      where: { id: application.linkedAffiliateId },
    });
  }

  return provisionAffiliate({
    email: application.email,
    displayName: application.displayName,
    parentAffiliateId: application.referredByAffiliateId ?? null,
    afterCreate: async (affiliate, tx) => {
      await tx.affiliateApplication.update({
        where: { id: application.id },
        data: { status: "approved", linkedAffiliateId: affiliate.id },
      });
    },
  });
}
