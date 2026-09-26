/**
 * Branded HTML for lightweight transactional notification emails (new
 * commission, override earning, referral joined, payout status updates,
 * application status updates). Table-based layout with inlined styles for
 * email-client compatibility.
 */

import { COLOR } from "@/lib/email/templates/shared";
import { escapeHtml } from "@/lib/email/escapeHtml";

type Variant =
  | "conversion"
  | "override"
  | "referral"
  | "payout-approved"
  | "payout-paid"
  | "payout-rejected"
  | "application-rejected";

const ICON: Record<Variant, string> = {
  conversion: "🎉",
  override: "🤝",
  referral: "👥",
  "payout-approved": "✅",
  "payout-paid": "💸",
  "payout-rejected": "⚠️",
  "application-rejected": "📋",
};

export interface NotificationEmailData {
  variant: Variant;
  headline: string;
  message: string;
  amountLabel?: string;
  amountCaption?: string;
  ctaLabel: string;
  ctaUrl: string;
  logoWhiteUrl: string;
}

export function buildNotificationEmail(data: NotificationEmailData): string {
  const { variant, ctaLabel, ctaUrl, logoWhiteUrl } = data;
  const headline = escapeHtml(data.headline);
  const message = escapeHtml(data.message);
  const amountLabel = data.amountLabel !== undefined ? escapeHtml(data.amountLabel) : undefined;
  const amountCaption = data.amountCaption !== undefined ? escapeHtml(data.amountCaption) : undefined;

  const amountBlock = amountLabel
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:22px auto 0;">
        <tr><td bgcolor="${COLOR.primaryTint}" align="center" style="border-radius:14px;padding:18px 32px;">
          <div style="font:700 30px/1 'Poppins',Arial,Helvetica,sans-serif;color:${COLOR.ink};">${amountLabel}</div>
          ${amountCaption ? `<div style="margin-top:6px;font:600 12px/1.4 Arial,Helvetica,sans-serif;color:${COLOR.muted};">${amountCaption}</div>` : ""}
        </td></tr>
      </table>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${headline}</title>
<style>
  body,table,td,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
  body { margin:0; padding:0; width:100%; background:#f3f4fb; }
  @media screen and (max-width:600px) {
    .wrap { width:100% !important; }
    .px { padding-left:20px !important; padding-right:20px !important; }
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
      <img src="${logoWhiteUrl}" width="110" alt="LumeraMD" style="display:block;" />
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td class="px" align="center" style="padding:48px 40px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td
        style="width:64px;height:64px;border-radius:50%;background:${COLOR.primaryTint};font-size:28px;line-height:64px;text-align:center;">${ICON[variant]}</td></tr></table>

      <div style="margin-top:20px;font:700 24px/1.3 'Poppins',Arial,Helvetica,sans-serif;color:${COLOR.ink};">${headline}</div>

      <div style="margin-top:10px;font:400 14px/1.6 Arial,Helvetica,sans-serif;color:${COLOR.muted};max-width:400px;">
        ${message}
      </div>

      ${amountBlock}

      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:28px;">
        <tr><td bgcolor="${COLOR.primary}" style="border-radius:10px;">
          <a href="${ctaUrl}" style="display:inline-block;padding:13px 24px;font:700 14px/1 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;">${ctaLabel} &nbsp;→</a>
        </td></tr>
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
