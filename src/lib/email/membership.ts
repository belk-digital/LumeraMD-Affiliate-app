import { sendEmail } from "@/lib/email/send";
import { buildNotificationEmail } from "@/lib/email/templates/notification";
import { buildMagicLinkEmail } from "@/lib/email/templates/magic-link";
import type { CustomerSignup } from "@/generated/prisma/client";
import { PLANS, type PlanKey } from "@/lib/membership/plans";
import { notifyAdminNewMember } from "@/lib/email/admin";
import { authnetConfigured } from "@/lib/authnet/client";

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";
const LOGO_WHITE_URL = `${APP_BASE_URL}/lumera-logo-white.png`;

const planName = (c: CustomerSignup) => PLANS[c.plan as PlanKey]?.name ?? c.plan;
const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** The page where a member pays, or null while online payment isn't set up (payments are then recorded by an admin). */
export const payLinkFor = (customer: CustomerSignup) =>
  authnetConfigured() ? `${APP_BASE_URL}/pay/${customer.id}` : null;

/** Sent right after signup, so the customer knows what happens next. */
export async function notifyMembershipRequested(customer: CustomerSignup) {
  const payLink = payLinkFor(customer);
  await sendEmail(
    customer.email,
    "We received your LumeraMD membership request",
    buildNotificationEmail({
      variant: "membership-requested",
      headline: "We Got Your Request",
      message: payLink
        ? `Thanks, ${customer.firstName}! Your ${planName(customer)} membership starts as soon as your first payment goes through. If you haven't paid yet, you can do it any time with the button below.`
        : `Thanks, ${customer.firstName}! Your ${planName(customer)} membership is waiting for its first payment. We'll email you as soon as it's active. You can check its status any time in your account.`,
      ctaLabel: payLink ? "Pay Now" : "View Your Account",
      ctaUrl: payLink ?? `${APP_BASE_URL}/account/login`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
  await notifyAdminNewMember({
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    planName: planName(customer),
  });
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
  const payLink = payLinkFor(customer);
  await sendEmail(
    customer.email,
    "Your LumeraMD membership payment is overdue",
    buildNotificationEmail({
      variant: "membership-alert",
      headline: "Payment Overdue",
      message: payLink
        ? `We couldn't take this month's payment for your ${planName(customer)} membership, so your member discount is paused. Pay with a current card below and it comes right back.`
        : `We haven't received this month's payment for your ${planName(customer)} membership, so your member discount is paused. Contact us to get back on track and it comes right back.`,
      ctaLabel: payLink ? "Pay Now" : "View Your Account",
      ctaUrl: payLink ?? `${APP_BASE_URL}/account/login`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

/** Sent when an admin adds someone to a paid membership: it is ready, and here is where to set up the monthly payment. */
export async function notifyMembershipInvite(customer: CustomerSignup) {
  const payLink = payLinkFor(customer);
  const plan = PLANS[customer.plan as PlanKey];
  const price = plan ? `$${plan.monthlyPrice} per month` : "monthly";
  await sendEmail(
    customer.email,
    "Your LumeraMD membership is ready",
    buildNotificationEmail({
      variant: "membership-requested",
      headline: "Your Membership Is Ready",
      message: payLink
        ? `Hi ${customer.firstName}, we set up a ${planName(customer)} membership (${price}) for you. Your benefits start as soon as your first payment goes through. Use the button below to add your card; it renews monthly.`
        : `Hi ${customer.firstName}, we set up a ${planName(customer)} membership (${price}) for you. We will email you as soon as it is active. You can check its status any time in your account.`,
      ctaLabel: payLink ? "Set Up Payment" : "View Your Account",
      ctaUrl: payLink ?? `${APP_BASE_URL}/account/login`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

/** Sent when a sales rep is approved: their Premium membership starts with the first payment. */
export async function notifyRepPaymentDue(customer: CustomerSignup) {
  const payLink = payLinkFor(customer);
  if (!payLink) return;
  await sendEmail(
    customer.email,
    "Activate your LumeraMD Premium membership",
    buildNotificationEmail({
      variant: "membership-requested",
      headline: "One Last Step",
      message: `You're approved, ${customer.firstName}! Your ${planName(customer)} membership (${PLANS[customer.plan as PlanKey] ? `$${PLANS[customer.plan as PlanKey].monthlyPrice} per month` : "monthly"}) switches on your member benefits and override commissions as soon as your first payment goes through.`,
      ctaLabel: "Pay & Activate",
      ctaUrl: payLink,
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
