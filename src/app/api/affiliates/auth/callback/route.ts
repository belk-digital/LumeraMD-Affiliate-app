import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAffiliateSessionCookie } from "@/lib/affiliates/session";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const token = req.nextUrl.searchParams.get("token");

  if (!token) return NextResponse.redirect(`${origin}/login?error=invalid_token`);

  const record = await prisma.affiliateLoginToken.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.redirect(`${origin}/login?error=invalid_token`);
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: record.affiliateId },
  });
  if (!affiliate || affiliate.status !== "approved") {
    return NextResponse.redirect(`${origin}/login?error=invalid_token`);
  }

  await prisma.affiliateLoginToken.update({
    where: { token },
    data: { usedAt: new Date() },
  });

  await setAffiliateSessionCookie({
    affiliateId: affiliate.id,
    email: affiliate.userEmail,
  });

  return NextResponse.redirect(`${origin}/affiliates/dashboard/${affiliate.id}`);
}
