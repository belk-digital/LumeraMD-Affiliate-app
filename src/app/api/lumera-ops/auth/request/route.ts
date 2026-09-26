import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isAllowedAdminEmail } from "@/lib/admin/session";
import { sendMagicLinkEmail } from "@/lib/admin/sendMagicLink";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));

  if (typeof email !== "string" || !isAllowedAdminEmail(email)) {
    // Same response whether or not the email is allowed, to avoid leaking who's an admin.
    return NextResponse.json({ ok: true });
  }

  const ip = getClientIp(req);
  const [byIp, byEmail] = await Promise.all([
    checkRateLimit("admin-login-ip", ip, 10, "15 m"),
    checkRateLimit("admin-login-email", email.trim().toLowerCase(), 3, "15 m"),
  ]);
  if (!byIp.ok || !byEmail.ok) {
    const retryAfterSeconds = Math.max(
      byIp.ok ? 0 : byIp.retryAfterSeconds,
      byEmail.ok ? 0 : byEmail.retryAfterSeconds,
    );
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.adminLoginToken.create({
    data: { email: email.toLowerCase(), token, expiresAt },
  });

  const link = `${process.env.APP_BASE_URL}/api/lumera-ops/auth/callback?token=${token}`;
  await sendMagicLinkEmail(email, link);

  return NextResponse.json({ ok: true });
}
