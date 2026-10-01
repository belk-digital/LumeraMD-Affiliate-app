import { NextResponse } from "next/server";
import { clearCustomerSessionCookie } from "@/lib/customers/session";

export async function POST() {
  await clearCustomerSessionCookie();
  return NextResponse.json({ ok: true });
}
