/** Every email is copied here so the team can see what customers and affiliates receive. */
export const MONITOR_CC = "main.belkdigital@gmail.com";

/**
 * "sent" = handed to the email provider, "logged" = no provider is configured so it was only
 * printed to the server log, "failed" = the provider rejected it.
 */
export type SendResult = "sent" | "logged" | "failed";

/** Writes the attempt to the admin Email logs page. Never throws: a logging problem must not stop an email. */
async function recordEmail(
  to: string,
  subject: string,
  status: SendResult,
  extra: { error?: string; providerId?: string } = {},
) {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.emailLog.create({
      data: {
        toEmail: to.slice(0, 320),
        subject: subject.slice(0, 500),
        status,
        error: extra.error?.slice(0, 1000),
        providerId: extra.providerId,
      },
    });
  } catch (err) {
    console.error("Could not record the email in the log", err);
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[dev] Email to ${to}: ${subject}\n${html}`);
    await recordEmail(to, subject, "logged");
    return "logged";
  }

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "LumeraMD Affiliates <notifications@lumeramd.biz>",
        to,
        // No copy when the recipient is already the monitor address.
        ...(to.toLowerCase() === MONITOR_CC ? {} : { cc: MONITOR_CC }),
        subject,
        html,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to send email to ${to}: ${message}`);
    await recordEmail(to, subject, "failed", { error: message });
    return "failed";
  }

  if (!res.ok) {
    const body = await res.text();
    console.error(`Failed to send email to ${to}: ${body}`);
    await recordEmail(to, subject, "failed", { error: `${res.status}: ${body}` });
    return "failed";
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  await recordEmail(to, subject, "sent", { providerId: data.id });
  return "sent";
}
