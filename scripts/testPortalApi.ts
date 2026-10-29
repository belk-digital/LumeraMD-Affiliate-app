// The customer portal integration: the read API (key checks, lookups, paging, what is exposed) and
// the outgoing signed notifications (delivery, signature, failure then retry). A local HTTP server
// plays the portal. Refuses to run against production, sends no email and touches no Shopify store.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx --env-file=.env.local scripts/testPortalApi.ts
import "dotenv/config";
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { cancelMembership, grantComplimentary, processMembershipLifecycle, recordMembershipPayment } from "../src/lib/membership/lifecycle";
import { resendPortalEvent, retryPortalEvents, sendPortalTestPing } from "../src/lib/portal/events";
import { createPortalApiKey, revokePortalApiKey } from "../src/lib/portal/keys";
import { GET as listOrLookup } from "../src/app/api/v1/members/route";
import { GET as byId } from "../src/app/api/v1/members/[id]/route";

const TAG = `portal${Date.now()}`;
let KEY = "";
const SECRET = crypto.randomBytes(24).toString("hex");
const say = (s: string) => process.stdout.write(`${s}\n`);
const ok = (label: string) => say(`  ✓ ${label}`);
const realLog = console.log;
const quiet = () => (console.log = () => {}); // the email stand-in prints whole messages
const loud = () => (console.log = realLog);
const OPTS = { skipShopify: true };
const keyIds: string[] = [];

type Hit = { headers: http.IncomingHttpHeaders; body: string };
const hits: Hit[] = [];
let respondWith = 200;

const req = (path: string, key: string | null = KEY) =>
  new NextRequest(`http://localhost${path}`, { headers: key ? { authorization: `Bearer ${key}` } : {} });
const get = async (path: string, key: string | null = KEY) => {
  const res = await listOrLookup(req(path, key));
  return { status: res.status, body: await res.json() };
};

/** The documented way to check a signature, written out independently of the sending code. */
function signatureValid(hit: Hit) {
  const header = String(hit.headers["x-lumera-signature"] ?? "");
  const t = /t=(\d+)/.exec(header)?.[1];
  const v1 = /v1=([0-9a-f]+)/.exec(header)?.[1];
  if (!t || !v1) return false;
  const expected = crypto.createHmac("sha256", SECRET).update(`${t}.${hit.body}`).digest("hex");
  return expected === v1 && Math.abs(Date.now() / 1000 - Number(t)) < 300;
}

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  say(`database host: ${host}`);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  const server = http.createServer((rq, rs) => {
    let body = "";
    rq.on("data", (c) => (body += c));
    rq.on("end", () => {
      hits.push({ headers: rq.headers, body });
      rs.statusCode = respondWith;
      rs.end("ok");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const portalUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;

  const startedAt = new Date(Date.now() - 1000);
  const mk = (suffix: string, plan: string) =>
    prisma.customerSignup.create({
      data: { firstName: "Portal", lastName: suffix, email: `${TAG}-${suffix}@Example.test`, plan, phone: "5551234567" },
    });
  const paid = await mk("paid", "customer_basic");
  const unpaid = await mk("unpaid", "customer_plus");
  const free = await mk("free", "customer_premium");
  const gone = await mk("gone", "customer_basic");
  const rep = await mk("rep", "agent");
  const lapsing = await mk("lapsing", "customer_basic");
  const ids = [paid, unpaid, free, gone, rep, lapsing].map((c) => c.id);

  try {
    // ---- keys ----
    assert.equal((await get(`/api/v1/members?email=x@y.z`, null)).status, 401);
    assert.equal((await get(`/api/v1/members?email=x@y.z`, "wrong-key-wrong-key-wrong-key-xx")).status, 401);
    const wellFormedButUnknown = `lmd_live_${crypto.randomBytes(32).toString("base64url")}`;
    assert.equal((await get(`/api/v1/members?email=x@y.z`, wellFormedButUnknown)).status, 401);
    ok("no key, a malformed key and a well-formed key nobody issued are all refused");

    const first = await createPortalApiKey(`${TAG} first`, "tester@example.test");
    keyIds.push(first.record.id);
    KEY = first.token;
    assert.match(KEY, /^lmd_live_[A-Za-z0-9_-]{43}$/);
    assert.equal(first.record.prefix, KEY.slice(0, 13));
    assert.equal((await get(`/api/v1/members?email=x@y.z`)).status, 404); // right key: just no such member
    const unauth = await byId(req("/api/v1/members/abc", null), { params: Promise.resolve({ id: "abc" }) });
    assert.equal(unauth.status, 401);
    ok("a new key works, on both endpoints, and shows up with a recognisable prefix");

    const stored = await prisma.portalApiKey.findUniqueOrThrow({ where: { id: first.record.id } });
    assert.ok(!JSON.stringify(stored).includes(KEY), "the key itself must not be stored");
    assert.equal(stored.keyHash, crypto.createHash("sha256").update(KEY).digest("hex"));
    assert.ok(stored.lastUsedAt, "first use is recorded");
    ok("only a hash of the key is stored, and its first use is recorded");

    const second = await createPortalApiKey(`${TAG} second`);
    keyIds.push(second.record.id);
    assert.equal(await revokePortalApiKey(first.record.id), true);
    assert.equal((await get(`/api/v1/members?email=x@y.z`)).status, 401);
    KEY = second.token;
    assert.equal((await get(`/api/v1/members?email=x@y.z`)).status, 404);
    assert.equal(await revokePortalApiKey("does-not-exist"), false);
    ok("revoking a key stops it immediately without affecting the other key");

    // ---- states ----
    process.env.PORTAL_WEBHOOK_URL = portalUrl;
    process.env.PORTAL_WEBHOOK_SECRET = SECRET;
    quiet();
    await recordMembershipPayment({ customerId: paid.id, amount: 49, source: "manual", externalId: `${TAG}-1` }, OPTS);
    await grantComplimentary(free.id, { note: "test" }, OPTS);
    await recordMembershipPayment({ customerId: gone.id, amount: 49, source: "manual", externalId: `${TAG}-2` }, OPTS);
    await recordMembershipPayment({ customerId: rep.id, amount: 79, source: "manual", externalId: `${TAG}-3` }, OPTS);
    loud();

    const a = (await get(`/api/v1/members?email=${encodeURIComponent(paid.email.toUpperCase())}`)).body.member;
    assert.equal(a.id, paid.id);
    assert.equal(a.tier, "basic");
    assert.equal(a.status, "active");
    assert.equal(a.payment_status, "paid");
    assert.equal(a.discount_eligible, true);
    assert.equal(a.web_discount_percent, 5);
    assert.ok(new Date(a.paid_through) > new Date());
    ok("lookup by email (any letter case) returns the member, tier, status and paid-through date");

    const b = await byId(req(`/api/v1/members/${unpaid.id}`), { params: Promise.resolve({ id: unpaid.id }) });
    const unpaidBody = (await b.json()).member;
    assert.deepEqual([unpaidBody.tier, unpaidBody.payment_status, unpaidBody.discount_eligible, unpaidBody.paid_through], ["plus", "unpaid", false, null]);
    ok("lookup by id works; a signup that never paid is unpaid with no discount");

    const f = (await get(`/api/v1/members?email=${free.email}`)).body.member;
    assert.deepEqual([f.tier, f.payment_status, f.complimentary, f.paid_through, f.discount_eligible], ["premium", "complimentary", true, null, true]);
    const r = (await get(`/api/v1/members?email=${rep.email}`)).body.member;
    assert.equal(r.tier, "sales_rep");
    ok("complimentary members and sales reps are labelled correctly");

    assert.deepEqual(Object.keys(a).sort(), [
      "activated_at", "cancelled_at", "complimentary", "discount_eligible", "email", "id", "paid_through",
      "payment_status", "status", "tier", "tier_name", "updated_at", "web_discount_percent",
    ]);
    assert.ok(!JSON.stringify(a).includes("MEMBER-"), "discount codes must not be exposed");
    assert.ok(!JSON.stringify(a).includes("5551234567"), "phone numbers must not be exposed");
    ok("only the agreed fields are exposed: no names, phone numbers or discount codes");

    // ---- paging ----
    const seen: string[] = [];
    let url = `/api/v1/members?updated_since=${startedAt.toISOString()}&limit=2`;
    for (let pages = 0; pages < 20; pages++) {
      const page = await get(url);
      assert.equal(page.status, 200);
      for (const m of page.body.members) seen.push(m.id);
      if (!page.body.next_cursor) break;
      url = `/api/v1/members?cursor=${page.body.next_cursor}&limit=2`;
    }
    assert.equal(new Set(seen).size, seen.length, "no member repeated across pages");
    for (const id of ids) assert.ok(seen.includes(id), "every changed member is listed");
    assert.equal((await get(`/api/v1/members`)).status, 400);
    assert.equal((await get(`/api/v1/members?cursor=garbage`)).status, 400);
    ok("the change list pages without skipping or repeating anyone, and rejects bad input");

    // ---- notifications ----
    const paymentHit = hits.find((h) => JSON.parse(h.body).type === "membership.payment_succeeded" && JSON.parse(h.body).data.member.id === paid.id);
    assert.ok(paymentHit, "payment notification was sent");
    assert.ok(signatureValid(paymentHit), "its signature is valid by the documented method");
    const evt = JSON.parse(paymentHit.body);
    assert.equal(evt.data.payment.amount, 49);
    assert.equal(evt.data.payment.first_payment, true);
    assert.equal(evt.data.member.payment_status, "paid");
    assert.equal(paymentHit.headers["x-lumera-delivery"], evt.id);
    assert.equal(paymentHit.headers["x-lumera-attempt"], "1");
    ok("a payment is announced once, signed correctly, with the payment and the member's new state");

    assert.ok(hits.some((h) => JSON.parse(h.body).type === "membership.complimentary_granted"));
    ok("granting free access is announced");

    const tampered = { ...paymentHit, body: paymentHit.body.replace('"amount":49', '"amount":1') };
    assert.ok(!signatureValid(tampered), "an altered body must not verify");
    ok("an altered notification fails the signature check");

    // A failed delivery is kept and retried, with the same delivery id.
    respondWith = 500;
    const before = hits.length;
    quiet();
    await cancelMembership(gone.id, OPTS);
    loud();
    const failed = await prisma.portalEvent.findFirstOrThrow({ where: { customerId: gone.id, type: "membership.cancelled" } });
    assert.deepEqual([failed.status, failed.attempts, failed.lastError], ["pending", 1, "HTTP 500"]);
    ok("a notification the portal rejects is kept for retry");

    respondWith = 200;
    await prisma.portalEvent.update({ where: { id: failed.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
    const retry = await retryPortalEvents();
    assert.ok(retry.delivered >= 1);
    const retried = hits.slice(before).filter((h) => h.headers["x-lumera-delivery"] === failed.id);
    assert.equal(retried.length, 2);
    assert.equal(retried[1].headers["x-lumera-attempt"], "2");
    assert.ok(signatureValid(retried[1]));
    const delivered = await prisma.portalEvent.findUniqueOrThrow({ where: { id: failed.id } });
    assert.equal(delivered.status, "delivered");
    assert.equal(JSON.parse(retried[1].body).data.member.status, "cancelled");
    ok("the retry reuses the same delivery id, counts as attempt 2 and succeeds");

    // Running out of attempts stops the retries.
    respondWith = 500;
    const doomed = await prisma.portalEvent.create({
      data: { type: "membership.cancelled", customerId: gone.id, payload: { id: "x", type: "membership.cancelled", created: 0, data: {} }, attempts: 7, nextAttemptAt: new Date(Date.now() - 1000) },
    });
    await retryPortalEvents();
    assert.equal((await prisma.portalEvent.findUniqueOrThrow({ where: { id: doomed.id } })).status, "failed");
    ok("after the last attempt an event is marked failed and not retried again");
    respondWith = 200;

    // "Send again" works on any stored notification, including one that gave up.
    const beforeResend = hits.length;
    const resent = await resendPortalEvent(doomed.id);
    assert.equal(resent?.status, "delivered");
    const resentHit = hits[beforeResend];
    assert.equal(resentHit.headers["x-lumera-delivery"], doomed.id);
    assert.ok(signatureValid(resentHit));
    assert.equal(await resendPortalEvent("does-not-exist"), null);
    ok("an admin can send a stored notification again, even one that gave up");

    // The test notification is signed, carries no member data, and reports what the portal said.
    const beforePing = hits.length;
    const ping = await sendPortalTestPing();
    assert.deepEqual([ping.ok, ping.status], [true, 200]);
    const pingHit = hits[beforePing];
    assert.ok(signatureValid(pingHit));
    assert.deepEqual(JSON.parse(pingHit.body).data, {});
    assert.equal(JSON.parse(pingHit.body).type, "test.ping");
    respondWith = 500;
    const badPing = await sendPortalTestPing();
    assert.equal(badPing.ok, false);
    assert.match(badPing.error ?? "", /500/);
    respondWith = 200;
    ok("the test notification is signed, carries no member data and reports the portal's answer");

    // A lapse is announced as an expiry.
    await prisma.customerSignup.update({
      where: { id: lapsing.id },
      data: { status: "active", activatedAt: new Date(), currentPeriodEnd: new Date(Date.now() - 10 * 86400000) },
    });
    const beforeLapse = hits.length;
    quiet();
    await processMembershipLifecycle(OPTS);
    loud();
    const expired = hits.slice(beforeLapse).map((h) => JSON.parse(h.body)).find((e) => e.type === "membership.expired" && e.data.member.id === lapsing.id);
    assert.ok(expired, "expiry notification was sent");
    assert.deepEqual([expired.data.member.status, expired.data.member.payment_status, expired.data.member.discount_eligible], ["past_due", "past_due", false]);
    ok("a membership that lapses past its grace period is announced as expired, with no discount");

    // Switched off: nothing is sent or stored.
    delete process.env.PORTAL_WEBHOOK_URL;
    const rowsBefore = await prisma.portalEvent.count({ where: { customerId: unpaid.id } });
    quiet();
    await recordMembershipPayment({ customerId: unpaid.id, amount: 79, source: "manual", externalId: `${TAG}-4` }, OPTS);
    loud();
    assert.equal(await prisma.portalEvent.count({ where: { customerId: unpaid.id } }), rowsBefore);
    assert.equal(await resendPortalEvent(doomed.id), null);
    const idle = await sendPortalTestPing();
    assert.equal(idle.ok, false);
    assert.match(idle.error ?? "", /configured/);
    ok("with no portal address configured, nothing is sent or stored, and resend and the test say so");

    say("\nAll portal integration checks passed.");
  } finally {
    loud();
    server.close();
    await prisma.portalEvent.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.portalApiKey.deleteMany({ where: { id: { in: keyIds } } });
    const wallets = await prisma.walletAccount.findMany({ where: { ownerKey: { contains: TAG.toLowerCase() } }, select: { id: true } });
    const walletIds = wallets.map((w) => w.id);
    await prisma.walletTransaction.deleteMany({ where: { accountId: { in: walletIds } } });
    await prisma.walletAccount.deleteMany({ where: { id: { in: walletIds } } });
    await prisma.customerSignup.deleteMany({ where: { id: { in: ids } } });
  }
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err instanceof Error ? (err.stack ?? err.message) : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
