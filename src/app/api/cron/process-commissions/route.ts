import { NextRequest, NextResponse } from "next/server";
import { processPendingConversions } from "@/lib/affiliates/processPending";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await processPendingConversions();
  return NextResponse.json({ ok: true, ...result });
}
