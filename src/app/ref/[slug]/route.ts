import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { updateAffiliateStats } from "@/lib/affiliates/stats";

const PUBLIC_DOMAIN = process.env.SHOPIFY_PUBLIC_DOMAIN ?? process.env.SHOPIFY_STORE_DOMAIN!;
// Where an affiliate's order link actually lands the shopper — the full catalog, not the homepage.
const LANDING_PATH = "/collections/all-products";

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

  const destination = new URL(`https://${PUBLIC_DOMAIN}${LANDING_PATH}`);

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

  // The cookies below live on this app's domain, which the storefront can't read. So the store
  // gets the tracking values in the URL instead: the theme snippet (shopify/affiliate-tracking.liquid)
  // keeps them on the store's own domain and writes them onto the cart, and they arrive on the
  // order as note attributes (affiliate_ref / affiliate_click_id).
  const landing = new URL(LANDING_PATH, destination);
  landing.searchParams.set("ref", affiliate.id);
  landing.searchParams.set("cid", click.id);
  landing.searchParams.set("d", String(affiliate.cookieDurationDays));
  const landingPath = landing.pathname + landing.search;

  if (affiliate.shopifyDiscountCode) {
    // Shopify applies the code, then sends the shopper on to the landing path.
    destination.pathname = "/discount/" + affiliate.shopifyDiscountCode;
    destination.searchParams.set("redirect", landingPath);
  } else {
    destination.pathname = landing.pathname;
    destination.search = landing.search;
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
