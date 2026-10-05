import { NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/admin/requireAdmin";
import { MONITOR_CC, sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { checkRateLimit } from "@/lib/rateLimit";

// Sends a test email to the signed-in admin, so they can confirm email delivery works end to end.
export async function POST() {
  const { session, error } = await requireAdminOrResponse();
  if (error) return error;

  const limit = await checkRateLimit("admin-test-email", session.email.toLowerCase(), 3, "1 h");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "That's enough test emails for now. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const result = await sendEmail(
    session.email,
    "LumeraMD test email",
    `<p>This is a test email from the LumeraMD admin settings.</p>
     <p>If you can read this, email delivery is working. A copy also goes to ${escapeHtml(MONITOR_CC)}.</p>`,
  );

  if (result === "failed") {
    return NextResponse.json(
      { error: "The email provider rejected the message. Check the server logs for details." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, result, to: session.email });
}
