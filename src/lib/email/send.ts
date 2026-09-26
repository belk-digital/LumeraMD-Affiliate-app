const MONITOR_CC = "main.belkdigital@gmail.com";

export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[dev] Email to ${to}: ${subject}\n${html}`);
    return;
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
  }
}
