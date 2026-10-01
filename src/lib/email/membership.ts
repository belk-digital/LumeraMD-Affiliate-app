import { sendEmail } from "@/lib/email/send";
import { buildNotificationEmail } from "@/lib/email/templates/notification";
import { buildMagicLinkEmail } from "@/lib/email/templates/magic-link";
import type { CustomerSignup } from "@/generated/prisma/client";
import { PLANS, type PlanKey } from "@/lib/membership/plans";

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";
const LOGO_WHITE_URL = `${APP_BASE_URL}/lumera-logo-white.png`;

const planName = (c: CustomerSignup) => PLANS[c.plan as PlanKey]?.name ?? c.plan;
const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** Sent right after signup, so the customer knows what happens next. */
export async function notifyMembershipRequested(customer: CustomerSignup) {
  await sendEmail(
    customer.email,
    "We received your LumeraMD membership request",
    buildNotificationEmail({
      variant: "membership-requested",
      headline: "We Got Your Request",
      message: `Thanks, ${customer.firstName}! Your ${planName(customer)} membership is waiting for its first payment. We'll email you as soon as it's active. You can check its status any time in your account.`,
      ctaLabel: "View Your Account",
      ctaUrl: `${APP_BASE_URL}/account/login`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
  await sendEmail(
    OPS_EMAIL,
    `New membership request: ${customer.email}`,
    `<p>${customer.firstName} ${customer.lastName} (${customer.email}) requested the ${planName(customer)} plan.</p>`,
  );
}

/** Sent when a payment makes the membership active. `discountCode` is shown only if one exists. */
export async function notifyMembershipActive(
  customer: CustomerSignup,
  opts: { discountCode: string | null; firstActivation: boolean },
) {
  const plan = PLANS[customer.plan as PlanKey];
  await sendEmail(
    customer.email,
    opts.firstActivation ? "Your LumeraMD membership is active" : "LumeraMD membership payment received",
    buildNotificationEmail({
      variant: "membership-active",
      headline: opts.firstActivation ? "Your Membership Is Active" : "Payment Received",
      message: opts.firstActivation
        ? `Welcome to LumeraMD ${planName(customer)}! ${plan ? `You get ${plan.webDiscountPercent}% off web pricing` : "Your member benefits are on"}${opts.discountCode ? " with your personal code below" : ""}. Your membership runs through ${customer.currentPeriodEnd ? fmtDate(customer.currentPeriodEnd) : "your next billing date"}.`
        : `Thanks! Your ${planName(customer)} membership now runs through ${customer.currentPeriodEnd ? fmtDate(customer.currentPeriodEnd) : "your next billing date"}.`,
      amountLabel: opts.discountCode ?? undefined,
      amountCaption: opts.discountCode ? "Your member discount code" : undefined,
      ctaLabel: "View Your Account",
      ctaUrl: `${APP_BASE_URL}/account/login`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

export async function notifyMembershipPastDue(customer: CustomerSignup) {
  await sendEmail(
    customer.email,
    "Your LumeraMD membership payment is overdue",
    buildNotificationEmail({
      variant: "membership-alert",
      headline: "Payment Overdue",
      message: `We haven't received this month's payment for your ${planName(customer)} membership, so your member discount is paused. Contact us to get back on track and it comes right back.`,
      ctaLabel: "View Your Account",
      ctaUrl: `${APP_BASE_URL}/account/login`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

export async function notifyMembershipCancelled(customer: CustomerSignup) {
  await sendEmail(
    customer.email,
    "Your LumeraMD membership was cancelled",
    buildNotificationEmail({
      variant: "membership-alert",
      headline: "Membership Cancelled",
      message: `Your ${planName(customer)} membership has been cancelled and your member discount code no longer works. You're always welcome back.`,
      ctaLabel: "Rejoin",
      ctaUrl: `${APP_BASE_URL}/customers/signup`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

export async function sendCustomerLoginEmail(email: string, link: string) {
  await sendEmail(
    email,
    "Your LumeraMD account login link",
    buildMagicLinkEmail({
      variant: "customer",
      loginUrl: link,
      supportEmail: OPS_EMAIL,
      heroImageUrl: `${APP_BASE_URL}/magic-email-banner.png`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}
