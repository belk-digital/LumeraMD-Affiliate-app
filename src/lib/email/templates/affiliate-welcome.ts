/**
 * Branded HTML for the "you're approved" affiliate welcome email.
 * Table-based layout with inlined styles for email-client compatibility.
 */

import { COLOR, LOGO_URL } from "@/lib/email/templates/shared";
import { escapeHtml } from "@/lib/email/escapeHtml";

function featureItem(emoji: string, title: string, desc: string) {
  return `
  <td align="center" valign="top" width="25%" style="padding:0 8px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td
      style="width:52px;height:52px;border-radius:50%;background:${COLOR.primaryTint};font-size:22px;line-height:52px;text-align:center;">${emoji}</td></tr></table>
    <div style="margin-top:12px;font:700 14px/1.3 Arial,Helvetica,sans-serif;color:${COLOR.ink};">${title}</div>
    <div style="margin-top:4px;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:${COLOR.muted};">${desc}</div>
  </td>`;
}

function whyItem(emoji: string, title: string) {
  return `
  <td align="center" valign="top" width="33%" style="padding:0 8px;">
    <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td
      style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.25);font-size:20px;line-height:46px;text-align:center;">${emoji}</td></tr></table>
    <div style="margin-top:10px;font:700 13px/1.3 Arial,Helvetica,sans-serif;color:#ffffff;">${title}</div>
  </td>`;
}

function stepItem(num: number, title: string, desc: string, isLast: boolean) {
  return `
  <tr>
    <td width="36" valign="top" style="padding:0 12px 0 0;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td
        style="width:28px;height:28px;border-radius:50%;background:${COLOR.primary};font:700 13px/28px Arial,Helvetica,sans-serif;color:#fff;text-align:center;">${num}</td></tr></table>
      ${isLast ? "" : `<div style="width:2px;height:34px;margin:4px auto;border-left:2px dotted ${COLOR.border};"></div>`}
    </td>
    <td valign="top" style="padding:0 0 ${isLast ? "0" : "20"}px;">
      <div style="font:700 15px/1.3 Arial,Helvetica,sans-serif;color:${COLOR.ink};">${title}</div>
      <div style="margin-top:2px;font:400 13px/1.5 Arial,Helvetica,sans-serif;color:${COLOR.muted};">${desc}</div>
    </td>
  </tr>`;
}

export interface AffiliateWelcomeEmailData {
  referralLink: string;
  dashboardUrl: string;
  discountCode: string;
  supportEmail: string;
  heroImageUrl: string;
  dashboardImageUrl: string;
  logoWhiteUrl: string;
}

export function buildAffiliateWelcomeEmail(data: AffiliateWelcomeEmailData): string {
  const { referralLink, dashboardUrl, discountCode, supportEmail, heroImageUrl, dashboardImageUrl, logoWhiteUrl } =
    data;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>Welcome to the LumeraMD Affiliate Program</title>
<style>
  body,table,td,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
  body { margin:0; padding:0; width:100%; background:#f3f4fb; }
  @media screen and (max-width:600px) {
    .wrap { width:100% !important; }
    .px { padding-left:20px !important; padding-right:20px !important; }
    .stack-25 { display:block !important; width:100% !important; padding-bottom:20px !important; }
    .hero-col { max-width:100% !important; }
    .btn-copy { display:block !important; width:100% !important; margin-top:10px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f3f4fb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4fb;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${COLOR.white};border-radius:20px;overflow:hidden;">

  <!-- HERO -->
  <tr>
    <td class="px" background="${heroImageUrl}" bgcolor="${COLOR.primaryDarker}"
        style="background-color:${COLOR.primaryDarker};background-image:linear-gradient(90deg, rgba(8,7,26,0.82) 0%, rgba(8,7,26,0.55) 38%, rgba(8,7,26,0.1) 72%), url('${heroImageUrl}');background-repeat:no-repeat,no-repeat;background-position:left top,center center;background-size:100% 100%,cover;padding:36px 40px 44px;">
      <!--[if mso]>
      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;">
        <v:fill type="frame" src="${heroImageUrl}" color="${COLOR.primaryDarker}" />
        <v:textbox inset="0,0,0,0">
      <![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td valign="top">
            <div class="hero-col" style="max-width:330px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="line-height:1;">
                  <img src="${logoWhiteUrl}" width="88" alt="LumeraMD" style="display:block;" />
                </td>
              </tr></table>
              <div style="margin-top:8px;font:400 12px/1 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.65);">Affiliate Program</div>

              <div style="margin-top:26px;font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.5px;color:${COLOR.primary};text-transform:uppercase;">Welcome</div>

              <div style="margin-top:10px;font:700 32px/1.15 'Poppins',Arial,Helvetica,sans-serif;color:#ffffff;">
                Let's Grow<br /><span style="color:${COLOR.accentLight};">Together</span>
              </div>

              <div style="margin-top:14px;font:400 14px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.75);">
                Welcome to the LumeraMD Affiliate Program! You're now part of a community earning rewards while helping more people access advanced wellness solutions.
              </div>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;">
                <tr><td bgcolor="${COLOR.primary}" style="border-radius:10px;">
                  <a href="${dashboardUrl}" style="display:inline-block;padding:13px 22px;font:700 14px/1 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;">Go to Your Dashboard &nbsp;→</a>
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
        <tr>
          ${featureItem("🤝", "Join a Trusted Brand", "Partner with a leading name in wellness and research.")}
          ${featureItem("🔗", "Share Your Link", "Promote your unique link on social media, email, or website.")}
          ${featureItem("📊", "Track in Real Time", "Monitor clicks, conversions, and earnings instantly.")}
          ${featureItem("🎁", "Earn Commissions", "Get paid for every qualified purchase from your referrals.")}
        </tr>
      </table>
    </td>
  </tr>

  <!-- AFFILIATE LINK -->
  <tr>
    <td class="px" style="padding:16px 40px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${COLOR.primaryTint}" style="border-radius:16px;">
        <tr><td style="padding:26px 26px 24px;">
          <div style="font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.5px;color:${COLOR.primary};text-transform:uppercase;">Your Affiliate Link</div>
          <div style="margin-top:8px;font:700 22px/1.3 'Poppins',Arial,Helvetica,sans-serif;color:${COLOR.ink};">Start Sharing &amp; Earning</div>
          <div style="margin-top:6px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:${COLOR.muted};">
            Share this unique link with your audience to earn commissions on every eligible purchase.
          </div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
            <tr>
              <td bgcolor="${COLOR.white}" style="border:1px solid ${COLOR.border};border-radius:10px 0 0 10px;padding:13px 16px;font:600 13px/1 Arial,Helvetica,sans-serif;color:${COLOR.ink};" class="stack-25">
                ${referralLink}
              </td>
              <td width="1" style="width:1px;"></td>
              <td bgcolor="${COLOR.primaryDark}" align="center" style="border-radius:0 10px 10px 0;padding:0;" class="btn-copy">
                <a href="${referralLink}" style="display:inline-block;padding:13px 20px;font:700 13px/1 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;white-space:nowrap;">Copy Link</a>
              </td>
            </tr>
          </table>

          <div style="margin-top:14px;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:${COLOR.muted};">
            Your discount code for referrals: <strong style="color:${COLOR.ink};">${escapeHtml(discountCode)}</strong>
          </div>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- HOW IT WORKS -->
  <tr>
    <td class="px" style="padding:36px 40px 8px;">
      <div style="font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.5px;color:${COLOR.primary};text-transform:uppercase;">How It Works</div>
      <div style="margin-top:8px;font:700 22px/1.3 'Poppins',Arial,Helvetica,sans-serif;color:${COLOR.ink};">Get Started in 3 Simple Steps</div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">
        <tr>
          <td valign="top" width="55%">
            <table role="presentation" cellpadding="0" cellspacing="0">
              ${stepItem(1, "Share Your Link", "Promote your unique link on social media, email, or your website.", false)}
              ${stepItem(2, "Drive Qualified Traffic", "Your audience clicks and makes a purchase on our store.", false)}
              ${stepItem(3, "Earn Commissions", "Track your sales and get paid every month.", true)}
            </table>
          </td>
          <td valign="top" width="45%" style="padding-left:16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLOR.border};border-radius:14px;">
              <tr><td style="border-radius:14px;overflow:hidden;line-height:0;">
                <img src="${dashboardImageUrl}" width="240" alt="Affiliate dashboard preview" style="display:block;width:100%;border-radius:14px;" />
              </td></tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;">
        <tr><td bgcolor="${COLOR.primaryDark}" style="border-radius:10px;">
          <a href="${dashboardUrl}" style="display:inline-block;padding:13px 22px;font:700 14px/1 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;">View Dashboard &nbsp;→</a>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- WHY PARTNER -->
  <tr>
    <td style="padding:36px 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${COLOR.primaryDark}">
        <tr><td class="px" style="padding:34px 40px;">
          <div style="font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:1.5px;color:${COLOR.accentLight};text-transform:uppercase;">Why Partner With LumeraMD</div>
          <div style="margin-top:8px;font:700 22px/1.3 'Poppins',Arial,Helvetica,sans-serif;color:#ffffff;">Trusted. Innovative. Impactful.</div>
          <div style="margin-top:6px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.7);max-width:420px;">
            Help more people access high-quality wellness solutions while earning rewarding commissions.
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;">
            <tr>
              ${whyItem("🛡️", "High Quality Products")}
              ${whyItem("🚚", "Fast &amp; Reliable Fulfillment")}
              ${whyItem("👥", "Growing Community")}
            </tr>
          </table>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- NEED HELP -->
  <tr>
    <td class="px" style="padding:32px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td valign="middle">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="width:44px;height:44px;border-radius:50%;background:${COLOR.primaryTint};font-size:18px;line-height:44px;text-align:center;">🎧</td>
              <td style="padding-left:14px;">
                <div style="font:700 14px/1.3 Arial,Helvetica,sans-serif;color:${COLOR.ink};">Need Help?</div>
                <div style="font:400 12px/1.5 Arial,Helvetica,sans-serif;color:${COLOR.muted};">Our support team is here to assist you with any questions about your account, payouts, or promotional materials.</div>
              </td>
            </tr></table>
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
    <td style="border-top:1px solid ${COLOR.border};padding:30px 40px;" align="center">
      <img src="${LOGO_URL}" width="100" alt="LumeraMD" style="display:block;margin:0 auto;" />
      <div style="margin-top:8px;font:400 11px/1 Arial,Helvetica,sans-serif;color:${COLOR.muted};">Better Science. Brighter Tomorrows.</div>
      <div style="margin-top:16px;font:400 11px/1.6 Arial,Helvetica,sans-serif;color:${COLOR.muted};">
        © ${new Date().getFullYear()} LumeraMD. All rights reserved.<br />
        <a href="https://www.lumeramd.com" style="color:${COLOR.muted};text-decoration:underline;">lumeramd.com</a>
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
