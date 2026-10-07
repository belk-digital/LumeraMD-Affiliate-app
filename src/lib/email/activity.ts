import { sendEmail } from "@/lib/email/send";
import { buildNotificationEmail } from "@/lib/email/templates/notification";
import type { Affiliate } from "@/generated/prisma/client";
import type { ActivityRules } from "@/lib/affiliates/activity";

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";
const LOGO_WHITE_URL = `${APP_BASE_URL}/lumera-logo-white.png`;

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** What is still needed, in words: "recruit 2 more affiliates, or reach $500 in sales". */
function stillNeeded(rules: ActivityRules, progress: { recruits: number; sales: number }) {
  const more = Math.max(rules.requiredRecruits - progress.recruits, 0);
  const recruit = `recruit ${more} more affiliate${more === 1 ? "" : "s"}`;
  if (rules.minSales > 0) {
    const left = Math.max(rules.minSales - progress.sales, 0);
    return `${recruit}, or reach $${rules.minSales.toLocaleString("en-US")} in your own sales ($${left.toLocaleString("en-US", { maximumFractionDigits: 0 })} to go)`;
  }
  return recruit;
}

export async function notifyActivityWarning(
  a: Affiliate,
  rules: ActivityRules,
  progress: { recruits: number; sales: number },
  daysLeft: number,
) {
  if (!a.emailNotifications) return;
  await sendEmail(
    a.userEmail,
    `${daysLeft} days left to stay active`,
    buildNotificationEmail({
      variant: "membership-alert",
      headline: "Stay Active",
      message: `Your activity cycle ends in ${daysLeft} days. To keep your account active, ${stillNeeded(rules, progress)} before then.`,
      ctaLabel: "View Your Progress",
      ctaUrl: `${APP_BASE_URL}/affiliates/dashboard/${a.id}/compensation`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

export async function notifyActivityPassed(a: Affiliate, nextEnd: Date) {
  if (!a.emailNotifications) return;
  await sendEmail(
    a.userEmail,
    "You're active for another cycle",
    buildNotificationEmail({
      variant: "membership-active",
      headline: "You're Still Active",
      message: `You met this cycle's requirement. Your next cycle runs through ${fmtDate(nextEnd)}.`,
      ctaLabel: "View Your Dashboard",
      ctaUrl: `${APP_BASE_URL}/affiliates/dashboard/${a.id}`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

/** Always sent (even with notifications off): losing access is something the person must be told. */
export async function notifyActivitySuspended(
  a: Affiliate,
  rules: ActivityRules,
  progress: { recruits: number; sales: number },
) {
  await sendEmail(
    a.userEmail,
    "Your LumeraMD affiliate account was suspended",
    buildNotificationEmail({
      variant: "membership-alert",
      headline: "Account Suspended",
      message: `Your ${rules.cycleDays}-day cycle ended with ${progress.recruits} of ${rules.requiredRecruits} recruits${rules.minSales > 0 ? ` and $${Math.round(progress.sales).toLocaleString("en-US")} in sales` : ""}, so your account has been suspended. Contact ${OPS_EMAIL} to be reactivated and start a new cycle.`,
      ctaLabel: "Contact Support",
      ctaUrl: `mailto:${OPS_EMAIL}`,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}
