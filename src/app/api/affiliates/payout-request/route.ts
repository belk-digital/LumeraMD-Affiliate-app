import { NextRequest, NextResponse } from "next/server";
import { getAffiliateSession } from "@/lib/affiliates/session";
import { requestPayout } from "@/lib/payouts/service";
import { payoutErrorResponse } from "@/lib/payouts/respond";

export async function POST(req: NextRequest) {
  const session = await getAffiliateSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Send the amount and how you want to be paid." }, { status: 400 });
  }

  try {
    const payout = await requestPayout(session.affiliateId, {
      amount: body.amount,
      payoutMethod: body.payoutMethod,
      payoutDetails: body.payoutDetails,
    });
    return NextResponse.json({ ok: true, payout });
  } catch (err) {
    return payoutErrorResponse(err);
  }
}
