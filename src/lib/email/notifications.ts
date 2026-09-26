import { sendEmail } from "@/lib/email/send";
import { buildAffiliateWelcomeEmail } from "@/lib/email/templates/affiliate-welcome";
import { buildNotificationEmail } from "@/lib/email/templates/notification";
import { escapeHtml } from "@/lib/email/escapeHtml";
import type {
  Affiliate,
  AffiliateApplication,
  AffiliateConversion,
  AffiliatePayout,
} from "@/generated/prisma/client";

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";
const LOGO_WHITE_URL = `${APP_BASE_URL}/lumera-logo-white.png`;

export async function notifyNewConversion(
  affiliate: Affiliate,
  conversion: AffiliateConversion,
) {
  await sendEmail(
    OPS_EMAIL,
    `New affiliate commission: ${affiliate.userEmail}`,
    `<p>${escapeHtml(affiliate.userEmail)} earned a commission on order ${escapeHtml(conversion.shopifyOrderName ?? "—")}.</p>
     <p>Amount: $${conversion.commissionAmount.toFixed(2)} (status: ${escapeHtml(conversion.status)})</p>`,
  );

  if (conversion.status !== "voided" && affiliate.emailNotifications) {
    await sendEmail(
      affiliate.userEmail,
      "You earned a commission!",
      buildNotificationEmail({
        variant: "conversion",
        headline: "You Earned a Commission!",
        message: `Nice work — you just earned a commission on order ${conversion.shopifyOrderName ?? "—"}.`,
        amountLabel: `$${conversion.commissionAmount.toFixed(2)}`,
        amountCaption: `Pending for ${affiliate.pendingPeriodDays} days before payout`,
        ctaLabel: "View Your Dashboard",
        ctaUrl: `${APP_BASE_URL}/affiliates/dashboard/${affiliate.id}`,
        logoWhiteUrl: LOGO_WHITE_URL,
      }),
    );
  }
}

export async function notifyParentOverrideEarning(
  parentAffiliate: Affiliate,
  amount: number,
) {
  if (!parentAffiliate.emailNotifications) return;
  await sendEmail(
    parentAffiliate.userEmail,
    "Your team earned you a commission!",
    buildNotificationEmail({
      variant: "override",
      headline: "Your Team Earned You a Commission!",
      message: "Someone on your team made a sale — you earned an override commission.",
      amountLabel: `$${amount.toFixed(2)}`,
      ctaLabel: "View Your Dashboard",
      ctaUrl: `${APP_BASE_URL}/affiliates/dashboard/${parentAffiliate.id}`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

export async function notifyAffiliateApproved(affiliate: Affiliate) {
  await sendEmail(
    affiliate.userEmail,
    "Welcome to the LumeraMD Affiliate Program!",
    buildAffiliateWelcomeEmail({
      referralLink: `${APP_BASE_URL}/ref/${affiliate.referralSlug}`,
      dashboardUrl: `${APP_BASE_URL}/affiliates/dashboard/${affiliate.id}`,
      discountCode: affiliate.shopifyDiscountCode ?? "—",
      supportEmail: OPS_EMAIL,
      heroImageUrl: `${APP_BASE_URL}/lumera-hero-banner.png`,
      dashboardImageUrl: `${APP_BASE_URL}/lumera-dashboard-image.png`,
      logoWhiteUrl: `${APP_BASE_URL}/lumera-logo-white.png`,
    }),
  );

  await sendEmail(
    OPS_EMAIL,
    `New affiliate approved: ${affiliate.userEmail}`,
    `<p>${escapeHtml(affiliate.userEmail)} was approved as an affiliate.</p>`,
  );

  if (affiliate.parentAffiliateId) {
    const { prisma } = await import("@/lib/prisma");
    const parent = await prisma.affiliate.findUnique({
      where: { id: affiliate.parentAffiliateId },
    });
    if (parent && parent.emailNotifications) {
      await sendEmail(
        parent.userEmail,
        "Someone you referred just joined!",
        buildNotificationEmail({
          variant: "referral",
          headline: "Someone You Referred Just Joined!",
          message: `${affiliate.userEmail} joined the LumeraMD Affiliate Program using your referral link.`,
          ctaLabel: "View Your Team",
          ctaUrl: `${APP_BASE_URL}/affiliates/dashboard/${parent.id}/team`,
          logoWhiteUrl: LOGO_WHITE_URL,
        }),
      );
    }
  }
}

export async function notifyPayoutRequested(
  affiliate: Affiliate,
  amount: number,
) {
  await sendEmail(
    OPS_EMAIL,
    `Payout request: ${affiliate.userEmail}`,
    `<p>${escapeHtml(affiliate.userEmail)} requested a payout of $${amount.toFixed(2)}.</p>
     <p><a href="${APP_BASE_URL}/lumera-ops/payouts">Review in admin</a></p>`,
  );
}

export async function notifyPayoutApproved(payout: AffiliatePayout) {
  const { prisma } = await import("@/lib/prisma");
  const affiliate = await prisma.affiliate.findUnique({ where: { id: payout.affiliateId } });
  if (!affiliate || !affiliate.emailNotifications) return;

  await sendEmail(
    affiliate.userEmail,
    "Your payout was approved!",
    buildNotificationEmail({
      variant: "payout-approved",
      headline: "Your Payout Was Approved!",
      message: "Your payout request was approved and will be sent soon.",
      amountLabel: `$${payout.amount.toFixed(2)}`,
      amountCaption: "Approved — sending soon",
      ctaLabel: "View Your Dashboard",
      ctaUrl: `${APP_BASE_URL}/affiliates/dashboard/${affiliate.id}/payouts`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

export async function notifyPayoutPaid(payout: AffiliatePayout) {
  const { prisma } = await import("@/lib/prisma");
  const affiliate = await prisma.affiliate.findUnique({ where: { id: payout.affiliateId } });
  if (!affiliate || !affiliate.emailNotifications) return;

  await sendEmail(
    affiliate.userEmail,
    "Your payout has been sent!",
    buildNotificationEmail({
      variant: "payout-paid",
      headline: "Your Payout Has Been Sent!",
      message: `Sent via ${payout.payoutMethod ?? "your chosen method"}${payout.transactionId ? ` (ref ${payout.transactionId})` : ""}.`,
      amountLabel: `$${payout.amount.toFixed(2)}`,
      amountCaption: "Paid",
      ctaLabel: "View Your Dashboard",
      ctaUrl: `${APP_BASE_URL}/affiliates/dashboard/${affiliate.id}/payouts`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

export async function notifyPayoutRejected(payout: AffiliatePayout) {
  const { prisma } = await import("@/lib/prisma");
  const affiliate = await prisma.affiliate.findUnique({ where: { id: payout.affiliateId } });
  if (!affiliate || !affiliate.emailNotifications) return;

  await sendEmail(
    affiliate.userEmail,
    "Your payout request was declined",
    buildNotificationEmail({
      variant: "payout-rejected",
      headline: "Your Payout Request Was Declined",
      message: payout.notes
        ? `Your request was declined: ${payout.notes}`
        : "Your request was declined. Contact us for details.",
      amountLabel: `$${payout.amount.toFixed(2)}`,
      amountCaption: "Declined",
      ctaLabel: "Contact Support",
      ctaUrl: `mailto:${OPS_EMAIL}`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

export async function notifyApplicationRejected(application: AffiliateApplication) {
  await sendEmail(
    application.email,
    "Update on your LumeraMD affiliate application",
    buildNotificationEmail({
      variant: "application-rejected",
      headline: "Your Application Wasn't Approved",
      message: application.reviewNotes
        ? `Thanks for your interest in the LumeraMD Affiliate Program. After review, we're not able to move forward at this time: ${application.reviewNotes}`
        : "Thanks for your interest in the LumeraMD Affiliate Program. After review, we're not able to move forward at this time.",
      ctaLabel: "Contact Support",
      ctaUrl: `mailto:${OPS_EMAIL}`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}
