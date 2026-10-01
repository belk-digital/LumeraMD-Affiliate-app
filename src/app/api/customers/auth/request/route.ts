import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendCustomerLoginEmail } from "@/lib/email/membership";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { findMembershipByEmail } from "@/lib/customers/lookup";

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));

  // Same response whether or not the email has a membership, so this can't be used to discover
  // who is a customer.
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ ok: true });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const ip = getClientIp(req);
  const [byIp, byEmail] = await Promise.all([
    checkRateLimit("customer-login-ip", ip, 10, "15 m"),
    checkRateLimit("customer-login-email", normalizedEmail, 3, "15 m"),
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

  const customer = await findMembershipByEmail(email);
  if (!customer) return NextResponse.json({ ok: true });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.customerLoginToken.create({
    data: {
      customerId: customer.id,
      token,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const link = `${process.env.APP_BASE_URL}/api/customers/auth/callback?token=${token}`;
  await sendCustomerLoginEmail(customer.email, link);

  return NextResponse.json({ ok: true });
}
