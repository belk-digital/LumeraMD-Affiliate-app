import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { hasAffiliateAccess } from "@/lib/affiliates/access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await hasAffiliateAccess(id))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) {
    return NextResponse.json({ error: "affiliate not found" }, { status: 404 });
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? "";

  // Two distinct links share this endpoint: the order/referral link (default) sends shoppers to
  // the store, while the team-invite link sends prospective sub-affiliates to the application
  // form. They must never encode to the same QR image or a sub-affiliate invite would silently
  // hand out the order link instead.
  const type = req.nextUrl.searchParams.get("type") === "invite" ? "invite" : "referral";
  const targetUrl =
    type === "invite"
      ? `${appBaseUrl}/affiliates/apply?ref=${affiliate.referralSlug}`
      : `${appBaseUrl}/ref/${affiliate.referralSlug}`;

  const buffer = await QRCode.toBuffer(targetUrl, {
    type: "png",
    width: 512,
    margin: 2,
    color: { dark: "#212635", light: "#ffffff" },
  });

  const download = req.nextUrl.searchParams.get("download") === "1";
  const filenamePrefix = type === "invite" ? "lumeramd-invite" : "lumeramd-referral";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="${filenamePrefix}-${affiliate.referralSlug}.png"`,
          }
        : {}),
    },
  });
}
