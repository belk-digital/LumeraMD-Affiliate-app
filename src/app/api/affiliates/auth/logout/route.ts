import { NextResponse } from "next/server";
import { clearAffiliateSessionCookie } from "@/lib/affiliates/session";

export async function POST() {
  await clearAffiliateSessionCookie();
  return NextResponse.json({ ok: true });
}
