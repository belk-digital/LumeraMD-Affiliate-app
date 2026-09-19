import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAdminSessionCookie } from "@/lib/admin/session";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const appUrl = req.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${appUrl}/admin/login?error=missing_token`);
  }

  const record = await prisma.adminLoginToken.findUnique({ where: { token } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.redirect(`${appUrl}/admin/login?error=invalid_token`);
  }

  await prisma.adminLoginToken.update({
    where: { token },
    data: { usedAt: new Date() },
  });

  await setAdminSessionCookie(record.email);

  return NextResponse.redirect(`${appUrl}/admin`);
}
