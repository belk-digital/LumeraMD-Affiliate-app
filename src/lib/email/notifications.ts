import { sendEmail } from "@/lib/email/send";
import type { Affiliate, AffiliateConversion } from "@/generated/prisma/client";

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";

export async function notifyNewConversion(
  affiliate: Affiliate,
  conversion: AffiliateConversion,
) {
  await sendEmail(
    OPS_EMAIL,
    `New affiliate commission: ${affiliate.userEmail}`,
    `<p>${affiliate.userEmail} earned a commission on order ${conversion.shopifyOrderName}.</p>
     <p>Amount: $${conversion.commissionAmount.toFixed(2)} (status: ${conversion.status})</p>`,
  );

  if (conversion.status !== "voided" && affiliate.emailNotifications) {
    await sendEmail(
      affiliate.userEmail,
      "You earned a commission!",
      `<p>Nice work — you just earned a $${conversion.commissionAmount.toFixed(2)} commission on order ${conversion.shopifyOrderName}.</p>
       <p>It'll show as pending for ${affiliate.pendingPeriodDays} days before becoming available for payout.</p>
       <p><a href="${APP_BASE_URL}/affiliates/dashboard/${affiliate.id}">View your dashboard</a></p>`,
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
    `<p>Someone on your team made a sale — you earned a $${amount.toFixed(2)} override commission.</p>
     <p><a href="${APP_BASE_URL}/affiliates/dashboard/${parentAffiliate.id}">View your dashboard</a></p>`,
  );
}

export async function notifyAffiliateApproved(affiliate: Affiliate) {
  await sendEmail(
    affiliate.userEmail,
    "Welcome to the LumeraMD Affiliate Program!",
    `<p>Your application has been approved. Here's your referral info:</p>
     <ul>
       <li>Referral link: ${APP_BASE_URL}/ref/${affiliate.referralSlug}</li>
       <li>Discount code: ${affiliate.shopifyDiscountCode}</li>
     </ul>
     <p><a href="${APP_BASE_URL}/affiliates/dashboard/${affiliate.id}">Go to your dashboard</a></p>`,
  );

  await sendEmail(
    OPS_EMAIL,
    `New affiliate approved: ${affiliate.userEmail}`,
    `<p>${affiliate.userEmail} was approved as an affiliate.</p>`,
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
        `<p>${affiliate.userEmail} joined the affiliate program using your referral link.</p>
         <p><a href="${APP_BASE_URL}/affiliates/dashboard/${parent.id}/team">View your team</a></p>`,
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
    `<p>${affiliate.userEmail} requested a payout of $${amount.toFixed(2)}.</p>
     <p><a href="${APP_BASE_URL}/admin/payouts">Review in admin</a></p>`,
  );
}
