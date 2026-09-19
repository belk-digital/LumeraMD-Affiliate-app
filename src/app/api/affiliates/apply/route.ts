import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    displayName,
    email,
    websiteUrl,
    socialLinks,
    promotionMethods,
    estimatedMonthlyReach,
    niche,
    agreedToTerms,
    referralSlug,
  } = body as {
    displayName?: string;
    email?: string;
    websiteUrl?: string;
    socialLinks?: unknown;
    promotionMethods?: string;
    estimatedMonthlyReach?: string;
    niche?: string;
    agreedToTerms?: boolean;
    referralSlug?: string;
  };

  if (!displayName?.trim() || !email || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "Please enter your name and a valid email." }, { status: 400 });
  }
  if (!agreedToTerms) {
    return NextResponse.json({ error: "You need to agree to the terms." }, { status: 400 });
  }

  const cleanEmail = email.trim();

  const existing = await prisma.affiliate.findFirst({
    where: { userEmail: { equals: cleanEmail, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: "This email is already an affiliate." }, { status: 409 });
  }

  // Who recruited this person? The invite link's slug wins, then the referral cookie.
  // Either way the referrer is looked up server-side; nothing about them is trusted from the client.
  const cookieAffiliateId = req.cookies.get("affiliate_ref")?.value;
  const referrer = referralSlug
    ? await prisma.affiliate.findUnique({ where: { referralSlug } })
    : cookieAffiliateId
      ? await prisma.affiliate.findUnique({ where: { id: cookieAffiliateId } })
      : null;
  const referredByAffiliateId =
    referrer &&
    referrer.status === "approved" &&
    referrer.userEmail.toLowerCase() !== cleanEmail.toLowerCase()
      ? referrer.id
      : null;

  const application = await prisma.affiliateApplication.create({
    data: {
      displayName: displayName.trim(),
      email: cleanEmail,
      websiteUrl: websiteUrl?.trim() || undefined,
      socialLinks: socialLinks as object | undefined,
      promotionMethods: promotionMethods?.trim() || undefined,
      estimatedMonthlyReach,
      niche,
      agreedToTerms,
      referredByAffiliateId,
      status: "pending",
    },
  });

  return NextResponse.json({ ok: true, application: { id: application.id } });
}
