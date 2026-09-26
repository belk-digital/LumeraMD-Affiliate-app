import { sendEmail } from "@/lib/email/send";
import { buildMagicLinkEmail } from "@/lib/email/templates/magic-link";

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";

export async function sendMagicLinkEmail(email: string, link: string) {
  await sendEmail(
    email,
    "Your admin login link",
    buildMagicLinkEmail({
      variant: "admin",
      loginUrl: link,
      supportEmail: OPS_EMAIL,
      heroImageUrl: `${APP_BASE_URL}/magic-email-banner.png`,
      logoWhiteUrl: `${APP_BASE_URL}/lumera-logo-white.png`,
    }),
  );
}
