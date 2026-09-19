import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const affiliate = await prisma.affiliate.findUnique({ where: { id } });
  if (!affiliate) {
    return NextResponse.json({ error: "affiliate not found" }, { status: 404 });
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const referralUrl = `${appBaseUrl}/ref/${affiliate.referralSlug}`;

  const buffer = await QRCode.toBuffer(referralUrl, {
    type: "png",
    width: 512,
    margin: 2,
    color: { dark: "#212635", light: "#ffffff" },
  });

  const download = req.nextUrl.searchParams.get("download") === "1";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="lumeramd-referral-${affiliate.referralSlug}.png"`,
          }
        : {}),
    },
  });
}
