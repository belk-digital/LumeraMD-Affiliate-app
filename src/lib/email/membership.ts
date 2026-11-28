import { sendEmail } from "@/lib/email/send";
import { buildNotificationEmail } from "@/lib/email/templates/notification";
import { buildMagicLinkEmail } from "@/lib/email/templates/magic-link";
import type { CustomerSignup } from "@/generated/prisma/client";
import { monthlyPriceFor, type PlanKey } from "@/lib/membership/plans";
import { getCatalog } from "@/lib/membership/plans.server";
import { notifyAdminNewMember } from "@/lib/email/admin";
import { authnetConfigured } from "@/lib/authnet/client";

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";
const LOGO_WHITE_URL = `${APP_BASE_URL}/lumera-logo-white.png`;

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** The page where a member pays, or null while online payment isn't set up (payments are then recorded by an admin). */
export const payLinkFor = (customer: CustomerSignup) =>
  authnetConfigured() ? `${APP_BASE_URL}/pay/${customer.id}` : null;

/** Sent right after signup, so the customer knows what happens next. */
export async function notifyMembershipRequested(customer: CustomerSignup) {
  const plans = (await getCatalog()).plans;
  const planName = (c: CustomerSignup) => plans[c.plan as PlanKey]?.name ?? c.plan;
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
  const plans = (await getCatalog()).plans;
  const planName = (c: CustomerSignup) => plans[c.plan as PlanKey]?.name ?? c.plan;
  const plan = plans[customer.plan as PlanKey];
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
  const plans = (await getCatalog()).plans;
  const planName = (c: CustomerSignup) => plans[c.plan as PlanKey]?.name ?? c.plan;
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
  const plans = (await getCatalog()).plans;
  const planName = (c: CustomerSignup) => plans[c.plan as PlanKey]?.name ?? c.plan;
  const payLink = payLinkFor(customer);
  const plan = plans[customer.plan as PlanKey];
  const price = plan ? `$${plan ? monthlyPriceFor(customer, plan) : 0} per month` : "monthly";
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
  const plans = (await getCatalog()).plans;
  const planName = (c: CustomerSignup) => plans[c.plan as PlanKey]?.name ?? c.plan;
  const payLink = payLinkFor(customer);
  if (!payLink) return;
  await sendEmail(
    customer.email,
    "Activate your LumeraMD Premium membership",
    buildNotificationEmail({
      variant: "membership-requested",
      headline: "One Last Step",
      message: `You're approved, ${customer.firstName}! Your ${planName(customer)} membership (${plans[customer.plan as PlanKey] ? `$${monthlyPriceFor(customer, plans[customer.plan as PlanKey])} per month` : "monthly"}) switches on your member benefits and override commissions as soon as your first payment goes through.`,
      ctaLabel: "Pay & Activate",
      ctaUrl: payLink,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

export async function notifyMembershipCancelled(customer: CustomerSignup) {
  const plans = (await getCatalog()).plans;
  const planName = (c: CustomerSignup) => plans[c.plan as PlanKey]?.name ?? c.plan;
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

/** Sent when an admin asks for the member to be emailed their payment link (to start, renew or switch back on). */
export async function notifyMembershipPaymentLink(customer: CustomerSignup, payLink: string) {
  const plans = (await getCatalog()).plans;
  const planName = (c: CustomerSignup) => plans[c.plan as PlanKey]?.name ?? c.plan;
  const name = planName(customer);
  const price = plans[customer.plan as PlanKey] ? `$${monthlyPriceFor(customer, plans[customer.plan as PlanKey])} per month` : "monthly";
  const copy =
    customer.status === "paused"
      ? {
          subject: "Switch your LumeraMD membership back on",
          headline: "Switch Your Membership Back On",
          message: `Hi ${customer.firstName}, your ${name} membership is paused. To switch it back on, complete your payment with the button below (${price}). Your benefits and member discount return as soon as it goes through, and it renews monthly after that.`,
          cta: "Pay & Reactivate",
        }
      : customer.status === "past_due"
        ? {
            subject: "Your LumeraMD membership payment is due",
            headline: "Payment Due",
            message: `Hi ${customer.firstName}, your ${name} membership payment is due (${price}). Use the button below to pay with a current card and your member discount comes right back.`,
            cta: "Pay Now",
          }
        : {
            subject: "Activate your LumeraMD membership",
            headline: "Your Membership Is Waiting",
            message: `Hi ${customer.firstName}, your ${name} membership (${price}) is ready and starts as soon as your first payment goes through. Use the button below to pay; it renews monthly.`,
            cta: "Pay & Activate",
          };
  await sendEmail(
    customer.email,
    copy.subject,
    buildNotificationEmail({
      variant: "membership-requested",
      headline: copy.headline,
      message: copy.message,
      ctaLabel: copy.cta,
      ctaUrl: payLink,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

/** Sent when an admin makes a membership free. `firstActivation` is true when it also switches the membership on. */
export async function notifyMembershipComplimentary(
  customer: CustomerSignup,
  opts: { discountCode: string | null; firstActivation: boolean; cardStopped: boolean },
) {
  const plans = (await getCatalog()).plans;
  const planName = (c: CustomerSignup) => plans[c.plan as PlanKey]?.name ?? c.plan;
  const name = planName(customer);
  await sendEmail(
    customer.email,
    opts.firstActivation ? "Your LumeraMD membership is active" : "Your LumeraMD membership is now complimentary",
    buildNotificationEmail({
      variant: "membership-active",
      headline: opts.firstActivation ? "Your Membership Is Active" : "Your Membership Is On Us",
      message: opts.firstActivation
        ? `Welcome to LumeraMD ${name}, ${customer.firstName}! Your membership is complimentary: there is nothing to pay and it has no end date.${opts.discountCode ? " Your personal member discount code is below." : ""}`
        : `Good news, ${customer.firstName}: your ${name} membership is now complimentary. There is nothing to pay and it has no end date.${opts.cardStopped ? " Your monthly card charge has been stopped, so you will not be billed again." : ""}${opts.discountCode ? " Your member discount code is below." : ""}`,
      amountLabel: opts.discountCode ?? undefined,
      amountCaption: opts.discountCode ? "Your member discount code" : undefined,
      ctaLabel: "View Your Account",
      ctaUrl: `${APP_BASE_URL}/account/login`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

/** Sent when an admin pauses a membership. */
export async function notifyMembershipPaused(customer: CustomerSignup, opts: { cardStopped: boolean }) {
  const plans = (await getCatalog()).plans;
  const planName = (c: CustomerSignup) => plans[c.plan as PlanKey]?.name ?? c.plan;
  await sendEmail(
    customer.email,
    "Your LumeraMD membership is paused",
    buildNotificationEmail({
      variant: "membership-alert",
      headline: "Membership Paused",
      message: `Your ${planName(customer)} membership has been paused by our team.${opts.cardStopped ? " Your monthly card charge has been stopped, so you will not be billed while it is paused." : ""} Your member discount code is on hold until it is switched back on. If you have any questions, just reply to this email or contact us.`,
      ctaLabel: "View Your Account",
      ctaUrl: `${APP_BASE_URL}/account/login`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

/** Sent when an admin switches a paused membership back on. */
export async function notifyMembershipResumed(
  customer: CustomerSignup,
  opts: { discountCode: string | null; billingResumed: boolean },
) {
  const plans = (await getCatalog()).plans;
  const planName = (c: CustomerSignup) => plans[c.plan as PlanKey]?.name ?? c.plan;
  await sendEmail(
    customer.email,
    "Your LumeraMD membership is active again",
    buildNotificationEmail({
      variant: "membership-active",
      headline: "Your Membership Is Back On",
      message: `Your ${planName(customer)} membership is active again, ${customer.firstName}.${
        customer.complimentary
          ? " It is complimentary, so there is nothing to pay."
          : customer.currentPeriodEnd
            ? ` It runs through ${fmtDate(customer.currentPeriodEnd)}.${opts.billingResumed ? " Your monthly billing picks up again then." : ""}`
            : ""
      }${opts.discountCode ? " Your member discount code works again and is below." : ""}`,
      amountLabel: opts.discountCode ?? undefined,
      amountCaption: opts.discountCode ? "Your member discount code" : undefined,
      ctaLabel: "View Your Account",
      ctaUrl: `${APP_BASE_URL}/account/login`,
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
