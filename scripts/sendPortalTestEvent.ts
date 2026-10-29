// Sends one signed test notification ("test.ping", no member data) to the portal's webhook address,
// so they can check their signature code before a real event arrives. Stores nothing.
//
//   PORTAL_WEBHOOK_URL=https://portal.example/hook PORTAL_WEBHOOK_SECRET=... pnpm dlx tsx scripts/sendPortalTestEvent.ts
import crypto from "node:crypto";
import { signPortalBody } from "../src/lib/portal/events";

async function main() {
  const url = process.env.PORTAL_WEBHOOK_URL;
  const secret = process.env.PORTAL_WEBHOOK_SECRET;
  if (!url || !secret) throw new Error("Set PORTAL_WEBHOOK_URL and PORTAL_WEBHOOK_SECRET.");
  const id = `test_${crypto.randomBytes(8).toString("hex")}`;
  const body = JSON.stringify({ id, type: "test.ping", created: Math.floor(Date.now() / 1000), data: {} });
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
    signal: AbortSignal.timeout(5000),
  });
  console.log(`Sent ${id} to ${new URL(url).host}: HTTP ${res.status}`);
  if (res.status < 200 || res.status >= 300) process.exitCode = 1;
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
