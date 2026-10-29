import { NextResponse } from "next/server";
import { PayoutError } from "@/lib/payouts/service";

/** Turns a payout rule failure into a response the admin or affiliate can read; anything else is a 500. */
export function payoutErrorResponse(err: unknown) {
  if (err instanceof PayoutError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("Payout request failed", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
