// End to end over real HTTP against a LOCAL dev server that already has the single sign-on settings
// (see the bash recipe at the bottom). It does what a member and the portal do together: the portal
// sends the member to sign in, the emailed link brings them back to finish, the portal's server swaps
// the code for tokens, then the member signs out. The emailed link's token is inserted straight into
// the dev database, as the request route would, so no email is needed.
//
//   BASE=http://localhost:3100 CLIENT_SECRET=... pnpm dlx tsx --env-file=.env.local scripts/e2eOidc.ts
import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../src/lib/prisma";

const BASE = process.env.BASE ?? "http://localhost:3100";
const SECRET = process.env.CLIENT_SECRET ?? "";
const CLIENT_ID = "lumeramd-portal";
const REDIRECT = `${BASE}/cb`;
const say = (s: string) => process.stdout.write(`${s}\n`);
const ok = (label: string) => say(`  ✓ ${label}`);

const get = (url: string, headers: Record<string, string> = {}) => fetch(url, { redirect: "manual", headers });

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  say(`database host: ${host}   server: ${BASE}`);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) throw new Error("Refusing to run against anything but a local server.");
  if (!SECRET) throw new Error("Set CLIENT_SECRET.");

  const TAG = `e2e${Date.now()}`;
  const member = await prisma.customerSignup.create({
    data: { firstName: "Eve", lastName: "Eetoe", email: `${TAG}@example.test`, plan: "customer_plus", status: "active", activatedAt: new Date() },
  });
  const created = [member.id];

  try {
    // ---- discovery over HTTP ----
    const discovery = await get(`${BASE}/.well-known/openid-configuration`);
    assert.equal(discovery.status, 200);
    assert.equal(discovery.headers.get("access-control-allow-origin"), "*");
    const doc = (await discovery.json()) as Record<string, string | string[]>;
    assert.equal(doc.issuer, BASE);
    assert.equal(doc.authorization_endpoint, `${BASE}/oauth/authorize`);
    const jwksRes = await get(String(doc.jwks_uri));
    assert.equal(jwksRes.status, 200);
    const jwks = (await jwksRes.json()) as { keys: crypto.JsonWebKeyInput["key"][] };
    assert.equal(jwks.keys.length, 1);
    ok("the discovery document and the public keys are served, and the issuer matches the site address");

    // ---- the portal sends the member to sign in; nobody is signed in yet ----
    const verifier = crypto.randomBytes(48).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT,
      scope: "openid email",
      state: "state-xyz",
      nonce: "nonce-123",
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    const start = await get(`${doc.authorization_endpoint}?${params}`);
    assert.equal(start.status, 307);
    const toLogin = new URL(start.headers.get("location")!);
    assert.equal(toLogin.pathname, "/account/login");
    const next = toLogin.searchParams.get("next")!;
    assert.ok(next.startsWith("/oauth/authorize?"), "the login page is told where to return to");
    const loginPage = await get(`${BASE}${toLogin.pathname}${toLogin.search}`);
    assert.equal(loginPage.status, 200);
    ok("a member who isn't signed in is sent to the member login, carrying the way back");

    // ---- they use the emailed link (made here as the request route would) ----
    const linkToken = crypto.randomBytes(32).toString("hex");
    await prisma.customerLoginToken.create({
      data: { customerId: member.id, token: linkToken, expiresAt: new Date(Date.now() + 600_000), next },
    });
    const callback = await get(`${BASE}/api/customers/auth/callback?token=${linkToken}`);
    assert.equal(callback.status, 307);
    assert.equal(callback.headers.get("location"), `${BASE}${next}`, "the link leads back to the sign-in, not to the account page");
    const cookie = (callback.headers.getSetCookie().find((c) => c.startsWith("customer_session=")) ?? "").split(";")[0];
    assert.ok(cookie.startsWith("customer_session="));
    const reused = await get(`${BASE}/api/customers/auth/callback?token=${linkToken}`);
    assert.match(reused.headers.get("location") ?? "", /error=invalid_token/);
    ok("the emailed link signs them in and returns them to the sign-in; the link works only once");

    // ---- signed in now: the sign-in completes with a code ----
    const back = await get(`${BASE}${next}`, { Cookie: cookie });
    assert.equal(back.status, 307);
    const portalUrl = new URL(back.headers.get("location")!);
    assert.equal(portalUrl.origin + portalUrl.pathname, REDIRECT);
    assert.equal(portalUrl.searchParams.get("state"), "state-xyz");
    assert.equal(portalUrl.searchParams.get("iss"), BASE);
    const code = portalUrl.searchParams.get("code")!;
    assert.ok(code);
    ok("with the member signed in, they are returned to the portal with a one-time code and the state they sent");

    // ---- the portal's server swaps the code ----
    const basic = `Basic ${Buffer.from(`${CLIENT_ID}:${SECRET}`).toString("base64")}`;
    const tokenRes = await fetch(String(doc.token_endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basic },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier }),
    });
    assert.equal(tokenRes.status, 200);
    assert.equal(tokenRes.headers.get("cache-control"), "no-store");
    const tokens = (await tokenRes.json()) as { access_token: string; id_token: string };
    const [h, p, s] = tokens.id_token.split(".");
    const publicKey = crypto.createPublicKey({ key: jwks.keys[0], format: "jwk" });
    assert.ok(crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, "base64url")));
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    assert.deepEqual([claims.iss, claims.aud, claims.sub, claims.email, claims.email_verified, claims.nonce], [BASE, CLIENT_ID, member.id, member.email, true, "nonce-123"]);
    ok("the code is swapped for a signed ID token naming the member, checked against the published key");

    const info = await fetch(String(doc.userinfo_endpoint), { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    assert.deepEqual(await info.json(), { sub: member.id, email: member.email, email_verified: true });
    const noInfo = await fetch(String(doc.userinfo_endpoint), { headers: { Authorization: "Bearer nope" } });
    assert.equal(noInfo.status, 401);
    ok("the user-info endpoint answers for the access token and refuses a bad one");

    const again = await fetch(String(doc.token_endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basic },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier }),
    });
    assert.equal(again.status, 400);
    assert.equal(((await again.json()) as { error: string }).error, "invalid_grant");
    const dead = await fetch(String(doc.userinfo_endpoint), { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    assert.equal(dead.status, 401, "replaying the code cancelled the token");
    const badClient = await fetch(String(doc.token_endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:wrong`).toString("base64")}` },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier }),
    });
    assert.equal(badClient.status, 401);
    ok("over HTTP too: a replayed code is refused and cancels its token; a wrong client secret is a 401");

    // ---- already signed in: no second login ----
    const verifier2 = crypto.randomBytes(48).toString("base64url");
    const second = new URLSearchParams(params);
    second.set("code_challenge", crypto.createHash("sha256").update(verifier2).digest("base64url"));
    second.set("state", "second");
    const silent = await get(`${BASE}/oauth/authorize?${second}`, { Cookie: cookie });
    assert.equal(silent.status, 307);
    assert.ok(new URL(silent.headers.get("location")!).searchParams.get("code"), "straight through, with no login page");
    ok("a member who is already signed in goes straight through: no second login");

    // ---- unsafe requests never redirect ----
    const evil = new URLSearchParams(params);
    evil.set("redirect_uri", "https://evil.example/cb");
    const refused = await get(`${BASE}/oauth/authorize?${evil}`, { Cookie: cookie });
    assert.equal(refused.status, 400);
    assert.equal(refused.headers.get("location"), null);
    assert.match(await refused.text(), /isn't valid/);
    ok("an unregistered return address gets an error page and is never redirected to");

    // ---- signing out ----
    const out = await get(
      `${BASE}/oauth/logout?${new URLSearchParams({ id_token_hint: tokens.id_token, post_logout_redirect_uri: `${BASE}/bye`, state: "bye-1" })}`,
      { Cookie: cookie },
    );
    // The post-logout address must be on the allow-list the server was started with.
    assert.ok([302, 307].includes(out.status));
    assert.equal(out.headers.get("location"), `${BASE}/bye?state=bye-1`);
    assert.ok(out.headers.getSetCookie().some((c) => c.startsWith("customer_session=") && /expires=Thu, 01 Jan 1970|max-age=0/i.test(c)), "the member session is cleared");
    const page = await get(`${BASE}/oauth/logout`, { Cookie: cookie });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /signed out/);
    ok("signing out clears the member session and returns to the portal's address, or shows a signed-out page");

    say("\nAll end-to-end single sign-on checks passed.");
  } finally {
    await prisma.oidcGrant.deleteMany({ where: { customerId: { in: created } } });
    await prisma.customerLoginToken.deleteMany({ where: { customerId: { in: created } } });
    await prisma.customerSignup.deleteMany({ where: { id: { in: created } } });
  }
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err instanceof Error ? (err.stack ?? err.message) : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
