import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isAllowedAdminEmail } from "@/lib/admin/session";
import { sendMagicLinkEmail } from "@/lib/admin/sendMagicLink";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (typeof email !== "string" || !isAllowedAdminEmail(email)) {
    // Same response whether or not the email is allowed, to avoid leaking who's an admin.
    return NextResponse.json({ ok: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.adminLoginToken.create({
    data: { email: email.toLowerCase(), token, expiresAt },
  });

  const link = `${process.env.APP_BASE_URL}/api/admin/auth/callback?token=${token}`;
  await sendMagicLinkEmail(email, link);

  return NextResponse.json({ ok: true });
}
