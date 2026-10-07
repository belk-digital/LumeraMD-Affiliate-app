import { NextRequest, NextResponse } from "next/server";
import { processPendingConversions } from "@/lib/affiliates/processPending";
import { processMembershipLifecycle } from "@/lib/membership/lifecycle";
import { processWalletRedemptions } from "@/lib/wallet/service";
import { processActivityCycles } from "@/lib/affiliates/activity";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await processPendingConversions();
  // Memberships ride the same daily job: lapsed ones become past due and lose their discount.
  const memberships = await processMembershipLifecycle();
  // Wallet codes nobody used by their deadline expire and the points go back to the member.
  const wallet = await processWalletRedemptions();
  // The 90-day activity cycle: roll over those who met it, warn and suspend those who did not.
  const activity = await processActivityCycles();
  return NextResponse.json({ ok: true, ...result, memberships, wallet, activity });
}
