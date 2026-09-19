import { NextRequest, NextResponse } from "next/server";

const PUBLIC_DOMAIN = process.env.SHOPIFY_PUBLIC_DOMAIN ?? process.env.SHOPIFY_STORE_DOMAIN!;

// Shopify's own /discount/CODE endpoint applies the code to the session
// and redirects to the shop (or ?redirect= target) — we just hand off to it.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const destination = new URL(`https://${PUBLIC_DOMAIN}/discount/${code}`);
  destination.searchParams.set("redirect", "/");
  return NextResponse.redirect(destination);
}
