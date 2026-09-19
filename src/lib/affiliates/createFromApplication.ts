import { prisma } from "@/lib/prisma";
import { createDiscountCode } from "@/lib/shopify/client";
import { notifyAffiliateApproved } from "@/lib/email/notifications";
import { createNotification } from "@/lib/notifications/create";

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
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

  const settings = await prisma.affiliateSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });

  const slug = slugify(application.displayName);
  const discountCode = slug.toUpperCase().replace(/-/g, "");

  await createDiscountCode({
    title: `Affiliate: ${application.displayName}`,
    code: discountCode,
    valueType: "percentage",
    value: 10,
  });

  const affiliate = await prisma.affiliate.create({
    data: {
      userEmail: application.email,
      displayName: application.displayName,
      status: "approved",
      referralSlug: slug,
      shopifyDiscountCode: discountCode,
      commissionRate: settings.defaultCommissionRate,
      commissionType: settings.defaultCommissionType,
      commissionOn: settings.defaultCommissionOn,
      cookieDurationDays: settings.defaultCookieDurationDays,
      pendingPeriodDays: settings.defaultPendingPeriodDays,
      minimumPayoutThreshold: settings.defaultMinimumPayoutThreshold,
      parentAffiliateId: application.referredByAffiliateId ?? null,
    },
  });

  await prisma.affiliateApplication.update({
    where: { id: application.id },
    data: { status: "approved", linkedAffiliateId: affiliate.id },
  });

  await notifyAffiliateApproved(affiliate);

  await createNotification(affiliate.id, {
    type: "welcome",
    title: "Welcome to the affiliate program!",
    body: "Your application was approved. Share your link, code or QR to start earning.",
  });
  if (affiliate.parentAffiliateId) {
    await createNotification(affiliate.parentAffiliateId, {
      type: "recruit_joined",
      title: "Someone you referred just joined",
      body: `${application.displayName} is now on your team.`,
    });
  }

  return affiliate;
}
