import { NextRequest, NextResponse } from "next/server";
import { verifyAuthnetWebhook } from "@/lib/authnet/client";
import { handleAuthnetPayment } from "@/lib/authnet/handlePayment";

// Authorize.net calls this for every event on the merchant account. Only successful charges matter
// here: the first payment on the hosted page and each monthly subscription charge. A failed renewal
// needs no event, because a membership with no payment lapses on its own after the grace period.
//
// A payment that Authorize.net's fraud filters hold for review isn't paid yet; it arrives as
// "authcapture" while held (and is skipped), then again as "fraud.approved" once someone approves it.
const PAYMENT_EVENTS = new Set([
  "net.authorize.payment.authcapture.created",
  "net.authorize.payment.fraud.approved",
]);
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifyAuthnetWebhook(rawBody, req.headers.get("x-anet-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { eventType?: string; payload?: { id?: string | number } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!event.eventType || !PAYMENT_EVENTS.has(event.eventType) || event.payload?.id === undefined) {
    return NextResponse.json({ ok: true, ignored: event.eventType ?? "unknown event" });
  }

  try {
    const result = await handleAuthnetPayment(String(event.payload.id));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // A 500 makes Authorize.net send the event again; recording the payment is safe to repeat.
    console.error("Authorize.net payment handling failed", event.payload.id, err);
    return NextResponse.json({ error: "could not process payment" }, { status: 500 });
  }
}
