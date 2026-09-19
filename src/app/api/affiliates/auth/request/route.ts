import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));

  // Same response whether or not the email belongs to an affiliate, so this
  // can't be used to discover who is registered.
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ ok: true });
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
    `<p>Click below to log in to your affiliate dashboard:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes. If you didn't request it, you can ignore this email.</p>`,
  );

  return NextResponse.json({ ok: true });
}
