import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { updateAffiliateStats } from "@/lib/affiliates/stats";

const PUBLIC_DOMAIN = process.env.SHOPIFY_PUBLIC_DOMAIN ?? process.env.SHOPIFY_STORE_DOMAIN!;

function hashIp(ip: string) {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const affiliate = await prisma.affiliate.findUnique({
    where: { referralSlug: slug },
  });

  const destination = new URL(`https://${PUBLIC_DOMAIN}/`);

  if (!affiliate || affiliate.status !== "approved") {
    return NextResponse.redirect(destination);
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const click = await prisma.affiliateClick.create({
    data: {
      affiliateId: affiliate.id,
      source: "referral_link",
      ipHash: hashIp(ip),
      deviceType: req.headers.get("user-agent")?.includes("Mobile")
        ? "mobile"
        : "desktop",
      referrer: req.headers.get("referer") ?? undefined,
    },
  });

  await updateAffiliateStats(affiliate.id);

  if (affiliate.shopifyDiscountCode) {
    destination.pathname = "/discount/" + affiliate.shopifyDiscountCode;
  }

  const res = NextResponse.redirect(destination);
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: affiliate.cookieDurationDays * 24 * 60 * 60,
    path: "/",
  };

  res.cookies.set("affiliate_ref", affiliate.id, cookieOpts);
  res.cookies.set("affiliate_click_id", click.id, cookieOpts);

  return res;
}
