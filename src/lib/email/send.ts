/** Every email is copied here so the team can see what customers and affiliates receive. */
export const MONITOR_CC = "main.belkdigital@gmail.com";

/**
 * "sent" = handed to the email provider, "logged" = no provider is configured so it was only
 * printed to the server log, "failed" = the provider rejected it.
 */
export type SendResult = "sent" | "logged" | "failed";

export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[dev] Email to ${to}: ${subject}\n${html}`);
    return "logged";
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "LumeraMD Affiliates <notifications@lumeramd.biz>",
      to,
      cc: MONITOR_CC,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    console.error(`Failed to send email to ${to}: ${await res.text()}`);
    return "failed";
  }
  return "sent";
}
