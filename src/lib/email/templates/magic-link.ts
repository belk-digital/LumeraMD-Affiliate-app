/**
 * Branded HTML for the affiliate / admin magic-link login email.
 * Table-based layout with inlined styles for email-client compatibility.
 */

import { COLOR } from "@/lib/email/templates/shared";

type Variant = "affiliate" | "admin";

const COPY: Record<
  Variant,
  {
    badge: string;
    eyebrow: string;
    headlineLead: string;
    headlineAccent: string;
    body: string;
    cta: string;
    account: string;
    features: [string, string][];
  }
> = {
  admin: {
    badge: "Affiliate Program Admin",
    eyebrow: "Admin Access",
    headlineLead: "Your Affiliate Admin Account",
    headlineAccent: "is Ready",
    body: "You now have access to the LumeraMD Affiliate Admin Dashboard. Log in to manage affiliates, track performance, view payouts, and more.",
    cta: "Log in to Admin Dashboard",
    account: "admin account",
    features: [
      ["Manage Affiliates", "Approve, remove, and support affiliates."],
      ["Track Performance", "Monitor clicks, conversions, and sales in real time."],
      ["Process Payouts", "Review and manage affiliate commissions."],
      ["Configure Settings", "Update program settings and resources."],
    ],
  },
  affiliate: {
    badge: "Affiliate Program",
    eyebrow: "Affiliate Access",
    headlineLead: "Your Affiliate Account",
    headlineAccent: "is Ready",
    body: "You now have access to your LumeraMD Affiliate Dashboard. Log in to share your link, track conversions, and manage payouts.",
    cta: "Log in to Your Dashboard",
    account: "affiliate account",
    features: [
      ["Share Your Link", "Promote your unique referral link anywhere."],
      ["Track Conversions", "Monitor clicks, conversions, and earnings live."],
      ["Manage Payouts", "Review pending and paid commissions."],
      ["Grow Your Team", "Invite sub-affiliates and earn overrides."],
    ],
  },
};

function featureItem(title: string, desc: string) {
  return `
  <td valign="top" width="50%" style="padding:0 8px 20px 0;">
    <div style="font:700 13px/1.3 Arial,Helvetica,sans-serif;color:${COLOR.ink};">${title}</div>
    <div style="margin-top:3px;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:${COLOR.muted};">${desc}</div>
  </td>`;
}

export interface MagicLinkEmailData {
  variant: Variant;
  loginUrl: string;
  supportEmail: string;
  heroImageUrl: string;
  logoWhiteUrl: string;
}

export function buildMagicLinkEmail(data: MagicLinkEmailData): string {
  const { variant, loginUrl, supportEmail, heroImageUrl, logoWhiteUrl } = data;
  const c = COPY[variant];

  const featureRows = [0, 2].map(
    (i) => `<tr>${featureItem(...c.features[i])}${featureItem(...c.features[i + 1])}</tr>`,
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>Your LumeraMD ${variant === "admin" ? "admin" : "affiliate"} login link</title>
<style>
  body,table,td,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
  body { margin:0; padding:0; width:100%; background:#f3f4fb; }
  @media screen and (max-width:600px) {
    .wrap { width:100% !important; }
    .px { padding-left:20px !important; padding-right:20px !important; }
    .hero-col { max-width:100% !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f3f4fb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4fb;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${COLOR.white};border-radius:20px;overflow:hidden;">

  <!-- TOP BAR -->
  <tr>
    <td class="px" bgcolor="${COLOR.primaryDark}" style="background:${COLOR.primaryDark};padding:20px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle"><img src="${logoWhiteUrl}" width="110" alt="LumeraMD" style="display:block;" /></td>
        <td align="right" valign="middle" style="font:600 12px/1 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.75);">${c.badge}</td>
      </tr></table>
    </td>
  </tr>

  <!-- HERO -->
  <tr>
    <td class="px" background="${heroImageUrl}" bgcolor="${COLOR.primaryTint}"
        style="background-color:${COLOR.primaryTint};background-image:linear-gradient(90deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.55) 42%, rgba(255,255,255,0.05) 72%), url('${heroImageUrl}');background-repeat:no-repeat,no-repeat;background-position:left top,right bottom;background-size:100% 100%,cover;padding:40px 40px 48px;min-height:360px;">
      <!--[if mso]>
      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;">
        <v:fill type="frame" src="${heroImageUrl}" color="${COLOR.primaryTint}" />
        <v:textbox inset="0,0,0,0">
      <![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td valign="top">
            <div class="hero-col" style="max-width:270px;">
              <div style="font:700 10px/1 Arial,Helvetica,sans-serif;letter-spacing:1.5px;color:${COLOR.primary};text-transform:uppercase;">${c.eyebrow}</div>

              <div style="margin-top:8px;font:700 22px/1.25 'Poppins',Arial,Helvetica,sans-serif;color:${COLOR.ink};">
                ${c.headlineLead}<br /><span style="color:${COLOR.primary};">${c.headlineAccent}</span>
              </div>

              <div style="margin-top:12px;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:${COLOR.muted};">
                ${c.body}
              </div>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;">
                <tr><td bgcolor="${COLOR.primary}" style="border-radius:10px;">
                  <a href="${loginUrl}" style="display:inline-block;padding:12px 20px;font:700 13px/1 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;">${c.cta} &nbsp;→</a>
                </td></tr>
              </table>
            </div>
          </td>
        </tr>
      </table>
      <!--[if mso]>
        </v:textbox>
      </v:rect>
      <![endif]-->
    </td>
  </tr>

  <!-- FEATURES -->
  <tr>
    <td class="px" style="padding:32px 40px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${featureRows.join("")}
      </table>
    </td>
  </tr>

  <!-- SECURE ACCESS -->
  <tr>
    <td class="px" style="padding:16px 40px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${COLOR.primaryTint}" style="border-radius:14px;">
        <tr><td style="padding:18px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td valign="top" style="width:34px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr><td
                style="width:30px;height:30px;border-radius:50%;background:${COLOR.white};font-size:14px;line-height:30px;text-align:center;">🔒</td></tr></table>
            </td>
            <td valign="top" style="padding-left:8px;">
              <div style="font:700 13px/1.3 Arial,Helvetica,sans-serif;color:${COLOR.ink};">Secure Access</div>
              <div style="margin-top:3px;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:${COLOR.muted};">
                This link is unique to your ${c.account} and expires in <strong style="color:${COLOR.ink};">15 minutes</strong>. Keep it private and don't share it with others.
              </div>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- NEED HELP -->
  <tr>
    <td class="px" style="padding:28px 40px 32px;border-top:1px solid ${COLOR.border};margin-top:8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
        <tr>
          <td valign="middle">
            <div style="font:400 12px/1.6 Arial,Helvetica,sans-serif;color:${COLOR.muted};max-width:340px;">
              If you didn't expect this email or need help accessing your account, please contact our support team.
            </div>
          </td>
          <td width="150" align="right" valign="middle">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${COLOR.white}" style="border:1px solid ${COLOR.primary};border-radius:10px;">
              <a href="mailto:${supportEmail}" style="display:inline-block;padding:11px 18px;font:700 13px/1 Arial,Helvetica,sans-serif;color:${COLOR.primary};text-decoration:none;white-space:nowrap;">Contact Support</a>
            </td></tr></table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td bgcolor="${COLOR.primaryDark}" style="background:${COLOR.primaryDark};padding:30px 40px;" align="center">
      <img src="${logoWhiteUrl}" width="100" alt="LumeraMD" style="display:block;margin:0 auto;" />
      <div style="margin-top:8px;font:400 11px/1 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.7);">Better Science. Brighter Tomorrows.</div>
      <div style="margin-top:16px;font:400 11px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.6);">
        © ${new Date().getFullYear()} LumeraMD. All rights reserved.<br />
        <a href="https://www.lumeramd.com" style="color:rgba(255,255,255,0.75);text-decoration:underline;">lumeramd.com</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
