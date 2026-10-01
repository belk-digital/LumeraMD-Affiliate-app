import { NextRequest, NextResponse } from "next/server";
import { processPendingConversions } from "@/lib/affiliates/processPending";
import { processMembershipLifecycle } from "@/lib/membership/lifecycle";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await processPendingConversions();
  // Memberships ride the same daily job: lapsed ones become past due and lose their discount.
  const memberships = await processMembershipLifecycle();
  return NextResponse.json({ ok: true, ...result, memberships });
}
