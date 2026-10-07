import { sendEmail } from "@/lib/email/send";
import { buildNotificationEmail } from "@/lib/email/templates/notification";

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";
// TEMPORARY, for testing on production: signup alerts go to this address instead of OPS_EMAIL.
// TO REVERT: set ADMIN_ALERT_EMAIL = OPS_EMAIL (info@lumeramd.com).
const ADMIN_ALERT_EMAIL = "main.belkdigital@gmail.com";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";
const LOGO_WHITE_URL = `${APP_BASE_URL}/lumera-logo-white.png`;

// "Someone signed up, please review" emails for the admins. The button opens the Signups page in
// the admin dashboard, where Approve / Reject (reps) and Manage (members) live. There is no
// one-click approve link on purpose: an email link that changes data can be triggered by anyone
// who gets hold of the email, so approval always happens after signing in to the dashboard.

const SIGNUPS_URL = `${APP_BASE_URL}/lumera-ops/signups`;

/** A new sales rep application is waiting for approval. */
export async function notifyAdminNewSalesRep(rep: {
  firstName: string | null;
  lastName: string | null;
  email: string;
  planName: string;
  referrer?: string | null;
}) {
  const name = [rep.firstName, rep.lastName].filter(Boolean).join(" ") || rep.email;
  await sendEmail(
    ADMIN_ALERT_EMAIL,
    `Approval needed: new affiliate ${name}`,
    buildNotificationEmail({
      variant: "membership-requested",
      headline: "New Affiliate Application",
      message: `${name} (${rep.email}) applied to become an affiliate on the ${rep.planName} plan${rep.referrer ? `, referred by ${rep.referrer}` : ""}. Review the application and approve or reject it in the admin dashboard.`,
      ctaLabel: "Review & Approve",
      ctaUrl: SIGNUPS_URL,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}

/** A new customer membership request is waiting for its first payment or approval. */
export async function notifyAdminNewMember(member: {
  firstName: string;
  lastName: string;
  email: string;
  planName: string;
  referrer?: string | null;
}) {
  const name = `${member.firstName} ${member.lastName}`.trim() || member.email;
  await sendEmail(
    ADMIN_ALERT_EMAIL,
    `New membership signup: ${name}`,
    buildNotificationEmail({
      variant: "membership-requested",
      headline: "New Membership Signup",
      message: `${name} (${member.email}) signed up for the ${member.planName} membership${member.referrer ? `, referred by ${member.referrer}` : ""}. Open the admin dashboard to record their first payment, or grant free access if you know them.`,
      ctaLabel: "Open Signups",
      ctaUrl: SIGNUPS_URL,
      logoWhiteUrl: LOGO_WHITE_URL,
    }),
  );
}
