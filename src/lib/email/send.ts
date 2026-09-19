export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[dev] Email to ${to}: ${subject}\n${html}`);
    return;
  }

  // Testing phase: redirect all mail to a single verified inbox instead of
  // real recipients, until a sending domain is verified in Resend.
  const overrideTo = process.env.EMAIL_OVERRIDE_TO;
  const actualTo = overrideTo ?? to;
  const actualSubject = overrideTo ? `[to: ${to}] ${subject}` : subject;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "LumeraMD Affiliates <onboarding@resend.dev>",
      to: actualTo,
      subject: actualSubject,
      html,
    }),
  });

  if (!res.ok) {
    console.error(`Failed to send email to ${to}: ${await res.text()}`);
  }
}
