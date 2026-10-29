import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { portalMember } from "@/lib/portal/member";

// Outgoing notifications to the customer portal. Every membership change that matters writes a
// PortalEvent row and tries to deliver it straight away; a failed delivery is retried with a growing
// delay (on the next event and by the daily job) until it succeeds or runs out of attempts.
//
// Configured by PORTAL_WEBHOOK_URL and PORTAL_WEBHOOK_SECRET. Without both, nothing is sent or stored.
// Delivery never throws: a portal outage must not break a payment, a cancellation or the daily job.

export type PortalEventType =
  | "membership.payment_succeeded"
  | "membership.cancelled"
  | "membership.expired"
  | "membership.complimentary_granted";

/** Wait before attempt 2, 3, ... Attempt count after which we stop is RETRY_DELAYS.length + 1. */
const RETRY_DELAYS_MINUTES = [1, 5, 30, 120, 360, 1440, 1440];
const MAX_ATTEMPTS = RETRY_DELAYS_MINUTES.length + 1;
const TIMEOUT_MS = 5000;

export const portalWebhookConfigured = () =>
  Boolean(process.env.PORTAL_WEBHOOK_URL && process.env.PORTAL_WEBHOOK_SECRET);

/** The signature header value: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`. */
export function signPortalBody(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

/** Records an event for a member and tries to deliver it. Safe to call anywhere; never throws. */
export async function emitPortalEvent(
  type: PortalEventType,
  customerId: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (!portalWebhookConfigured()) return;
  try {
    const customer = await prisma.customerSignup.findUnique({ where: { id: customerId } });
    if (!customer) return;
    const row = await prisma.portalEvent.create({
      data: { type, customerId, payload: {} },
    });
    // The id inside the body is the event's own id, so a retry or a duplicate can be recognised.
    const payload = {
      id: row.id,
      type,
      created: Math.floor(Date.now() / 1000),
      data: { member: portalMember(customer), ...extra },
    };
    const saved = await prisma.portalEvent.update({
      where: { id: row.id },
      data: { payload: payload as Prisma.InputJsonValue },
    });
    await deliver(saved);
    await retryPortalEvents(3); // pick up anything earlier that failed and is due
  } catch (err) {
    console.error("Portal event failed", type, customerId, err);
  }
}

async function deliver(event: { id: string; payload: unknown; attempts: number }) {
  const url = process.env.PORTAL_WEBHOOK_URL!;
  const secret = process.env.PORTAL_WEBHOOK_SECRET!;
  const body = JSON.stringify(event.payload);
  const attempt = event.attempts + 1;
  let error: string | null = null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "LumeraMD-Webhooks/1",
        "X-Lumera-Delivery": event.id,
        "X-Lumera-Attempt": String(attempt),
        "X-Lumera-Signature": signPortalBody(body, secret),
      },
      body,
      redirect: "manual", // a redirect is not an acknowledgement
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status < 200 || res.status >= 300) error = `HTTP ${res.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  if (!error) {
    await prisma.portalEvent.update({
      where: { id: event.id },
      data: { status: "delivered", attempts: attempt, deliveredAt: new Date(), lastError: null },
    });
    return;
  }
  const giveUp = attempt >= MAX_ATTEMPTS;
  await prisma.portalEvent.update({
    where: { id: event.id },
    data: {
      status: giveUp ? "failed" : "pending",
      attempts: attempt,
      lastError: error.slice(0, 500),
      nextAttemptAt: new Date(Date.now() + RETRY_DELAYS_MINUTES[Math.min(attempt - 1, RETRY_DELAYS_MINUTES.length - 1)] * 60_000),
    },
  });
  if (giveUp) console.error("Portal event gave up after", attempt, "attempts:", event.id, error);
}

/** Sends one more attempt for a stored event now (admin "Send again"), whatever its state. */
export async function resendPortalEvent(id: string) {
  if (!portalWebhookConfigured()) return null;
  const event = await prisma.portalEvent.findUnique({ where: { id } });
  if (!event) return null;
  await deliver(event);
  return prisma.portalEvent.findUnique({ where: { id } });
}

/**
 * Sends a signed "test.ping" (no member data, nothing stored) so the portal's team can check their
 * address and signature code. Reports what happened instead of throwing.
 */
export async function sendPortalTestPing(): Promise<{ ok: boolean; status?: number; ms: number; error?: string }> {
  const url = process.env.PORTAL_WEBHOOK_URL;
  const secret = process.env.PORTAL_WEBHOOK_SECRET;
  if (!url || !secret) return { ok: false, ms: 0, error: "No portal address or signing secret is configured." };
  const id = `test_${crypto.randomBytes(8).toString("hex")}`;
  const body = JSON.stringify({ id, type: "test.ping", created: Math.floor(Date.now() / 1000), data: {} });
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "LumeraMD-Webhooks/1",
        "X-Lumera-Delivery": id,
        "X-Lumera-Attempt": "1",
        "X-Lumera-Signature": signPortalBody(body, secret),
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ok = res.status >= 200 && res.status < 300;
    return { ok, status: res.status, ms: Date.now() - started, ...(ok ? {} : { error: `The portal answered HTTP ${res.status}.` }) };
  } catch (err) {
    return { ok: false, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Re-sends events that failed and are due. Called after each new event and by the daily job. */
export async function retryPortalEvents(limit = 50): Promise<{ retried: number; delivered: number }> {
  if (!portalWebhookConfigured()) return { retried: 0, delivered: 0 };
  const due = await prisma.portalEvent.findMany({
    where: { status: "pending", nextAttemptAt: { lte: new Date() }, attempts: { gt: 0 } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });
  let delivered = 0;
  for (const event of due) {
    await deliver(event);
    const after = await prisma.portalEvent.findUnique({ where: { id: event.id }, select: { status: true } });
    if (after?.status === "delivered") delivered += 1;
  }
  return { retried: due.length, delivered };
}
