import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAffiliateSession } from "@/lib/affiliates/session";

const PAYOUT_METHODS = ["zelle", "cashapp", "paypal"];

export async function PATCH(req: NextRequest) {
  const session = await getAffiliateSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const data: {
    displayName?: string | null;
    payoutMethod?: string | null;
    payoutDetails?: { destination: string };
    emailNotifications?: boolean;
  } = {};

  if ("displayName" in body) {
    const name = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (name.length > 80) {
      return NextResponse.json({ error: "Name must be 80 characters or fewer" }, { status: 400 });
    }
    data.displayName = name || null;
  }

  if ("payoutMethod" in body) {
    if (body.payoutMethod && !PAYOUT_METHODS.includes(body.payoutMethod)) {
      return NextResponse.json({ error: "Unsupported payout method" }, { status: 400 });
    }
    data.payoutMethod = body.payoutMethod || null;
  }

  if ("payoutDestination" in body) {
    const destination =
      typeof body.payoutDestination === "string" ? body.payoutDestination.trim() : "";
    if (destination.length > 200) {
      return NextResponse.json({ error: "Payout destination is too long" }, { status: 400 });
    }
    data.payoutDetails = { destination };
  }

  if ("emailNotifications" in body) {
    if (typeof body.emailNotifications !== "boolean") {
      return NextResponse.json({ error: "Invalid value" }, { status: 400 });
    }
    data.emailNotifications = body.emailNotifications;
  }

  const affiliate = await prisma.affiliate.update({
    where: { id: session.affiliateId },
    data,
  });

  return NextResponse.json({
    ok: true,
    affiliate: {
      displayName: affiliate.displayName,
      payoutMethod: affiliate.payoutMethod,
      emailNotifications: affiliate.emailNotifications,
    },
  });
}
