import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { buildMagicLinkEmail } from "@/lib/email/templates/magic-link";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const OPS_EMAIL = process.env.AFFILIATE_OPS_EMAIL ?? "info@lumeramd.com";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));

  // Same response whether or not the email belongs to an affiliate, so this
  // can't be used to discover who is registered.
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ ok: true });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const ip = getClientIp(req);
  const [byIp, byEmail] = await Promise.all([
    checkRateLimit("affiliate-login-ip", ip, 10, "15 m"),
    checkRateLimit("affiliate-login-email", normalizedEmail, 3, "15 m"),
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

  const affiliate = await prisma.affiliate.findFirst({
    where: { userEmail: { equals: email.trim(), mode: "insensitive" }, status: "approved" },
  });
  if (!affiliate) return NextResponse.json({ ok: true });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.affiliateLoginToken.create({
    data: {
      affiliateId: affiliate.id,
      token,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const link = `${process.env.APP_BASE_URL}/api/affiliates/auth/callback?token=${token}`;
  await sendEmail(
    affiliate.userEmail,
    "Your LumeraMD affiliate login link",
    buildMagicLinkEmail({
      variant: "affiliate",
      loginUrl: link,
      supportEmail: OPS_EMAIL,
      heroImageUrl: `${APP_BASE_URL}/magic-email-banner.png`,
      logoWhiteUrl: `${APP_BASE_URL}/lumera-logo-white.png`,
    }),
  );

  return NextResponse.json({ ok: true });
}
