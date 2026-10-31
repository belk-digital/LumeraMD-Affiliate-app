// Single sign-on ("Sign in with LumeraMD"): the OpenID Connect provider. This test plays the portal:
// it starts a sign-in with PKCE, exchanges the code, checks the ID token's signature the way a real
// client would, and then tries every way of getting it wrong. It uses a throwaway signing key and
// client secret, refuses to run against production, and deletes everything it makes.
//
//   export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"
//   pnpm dlx tsx --env-file=.env.local scripts/testOidc.ts
import "dotenv/config";
delete process.env.RESEND_API_KEY;
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { oidcConfigured } from "../src/lib/oidc/config";
import { discoveryDocument, jwksDocument } from "../src/lib/oidc/metadata";
import { authorize, exchangeCode, logoutDestination, purgeOidcGrants, userInfo } from "../src/lib/oidc/provider";
import { safeOidcNext } from "../src/lib/oidc/next";
import { POST as requestLoginLink } from "../src/app/api/customers/auth/request/route";

const TAG = `oidc${Date.now()}`;
const say = (s: string) => process.stdout.write(`${s}\n`);
const ok = (label: string) => say(`  ✓ ${label}`);

const REDIRECT = "https://portal.lumeramd.com/auth/lumera/callback";
const CLIENT_ID = "lumeramd-portal";
const SECRET = crypto.randomBytes(24).toString("hex");
const basic = (id: string, secret: string) => `Basic ${Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(secret)}`).toString("base64")}`;

const pkce = () => {
  const verifier = crypto.randomBytes(48).toString("base64url");
  return { verifier, challenge: crypto.createHash("sha256").update(verifier).digest("base64url") };
};

function authParams(challenge: string, extra: Record<string, string> = {}) {
  return new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    scope: "openid email",
    state: "st-123",
    nonce: "nonce-456",
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...extra,
  });
}

/** Signs in and returns the one-time code, as the portal's browser would receive it. */
async function getCode(email: string, extra: Record<string, string> = {}) {
  const { verifier, challenge } = pkce();
  const result = await authorize(authParams(challenge, extra), { email });
  assert.equal(result.kind, "redirect");
  if (result.kind !== "redirect") throw new Error("unreachable");
  const url = new URL(result.url);
  const code = url.searchParams.get("code");
  assert.ok(code, `expected a code, got ${result.url}`);
  return { code, verifier, url };
}

const tokenForm = (code: string, verifier: string, extra: Record<string, string> = {}) =>
  new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier, ...extra });

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/.*@([^/]+)\/.*/, "$1");
  say(`database host: ${host}`);
  if (!host || host.includes("cold-forest")) throw new Error("Refusing to run against production.");

  const created: string[] = [];
  const member = async (suffix: string, extra: Record<string, unknown> = {}) => {
    const c = await prisma.customerSignup.create({
      data: { firstName: "Jane", lastName: `Tester${suffix}`, email: `${TAG}-${suffix}@Example.test`, plan: "customer_basic", ...extra },
    });
    created.push(c.id);
    return c;
  };

  try {
    // ---- off until configured ----
    delete process.env.OIDC_PRIVATE_KEY;
    delete process.env.OIDC_CLIENT_SECRET_SHA256;
    delete process.env.OIDC_REDIRECT_URIS;
    process.env.APP_BASE_URL = "https://lumeramd.biz/";
    assert.equal(oidcConfigured(), false);
    const off = await authorize(authParams(pkce().challenge), null);
    assert.deepEqual([off.kind, off.kind === "page" && off.status], ["page", 503]);
    ok("single sign-on stays off until the key, secret and return address are all set");

    const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.OIDC_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n");
    process.env.OIDC_CLIENT_SECRET_SHA256 = crypto.createHash("sha256").update(SECRET).digest("hex");
    process.env.OIDC_REDIRECT_URIS = REDIRECT;
    process.env.OIDC_POST_LOGOUT_URIS = "https://portal.lumeramd.com/signed-out";
    assert.equal(oidcConfigured(), true);

    process.env.OIDC_PRIVATE_KEY = crypto.generateKeyPairSync("rsa", { modulusLength: 1024 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    assert.equal(oidcConfigured(), false, "a weak 1024-bit key is refused");
    process.env.OIDC_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n");
    assert.equal(oidcConfigured(), true);
    ok("a weak signing key is refused");

    // ---- discovery ----
    const doc = discoveryDocument();
    assert.equal(doc.issuer, "https://lumeramd.biz", "the issuer has no trailing slash");
    assert.equal(doc.authorization_endpoint, "https://lumeramd.biz/oauth/authorize");
    assert.deepEqual(doc.code_challenge_methods_supported, ["S256"]);
    assert.deepEqual(doc.id_token_signing_alg_values_supported, ["RS256"]);
    assert.ok(doc.token_endpoint_auth_methods_supported.includes("client_secret_basic"));
    const jwks = jwksDocument();
    assert.equal(jwks.keys.length, 1);
    assert.deepEqual([jwks.keys[0].kty, jwks.keys[0].alg, jwks.keys[0].use], ["RSA", "RS256", "sig"]);
    assert.ok(!JSON.stringify(jwks).includes('"d"'), "the private key is never published");
    ok("the discovery document and the public key are published, and only the public part");

    // ---- the sign-in request ----
    const { challenge } = pkce();
    const unregistered: Record<string, string>[] = [
      { client_id: "someone-else" },
      { redirect_uri: "https://evil.example/callback" },
      { redirect_uri: `${REDIRECT}/../evil` },
      { redirect_uri: "https://portal.lumeramd.com.evil.example/auth/lumera/callback" },
      { redirect_uri: `${REDIRECT}?x=1` },
      { redirect_uri: "" },
    ];
    for (const bad of unregistered) {
      const r = await authorize(authParams(challenge, bad), { email: "x@y.z" });
      assert.deepEqual([r.kind, r.kind === "page" && r.status], ["page", 400], JSON.stringify(bad));
    }
    ok("an unknown application or any return address that isn't exactly the registered one is refused without redirecting");

    for (const [extra, error] of [
      [{ response_type: "token" }, "unsupported_response_type"],
      [{ scope: "email" }, "invalid_scope"],
      [{ code_challenge_method: "plain" }, "invalid_request"],
      [{ code_challenge: "short" }, "invalid_request"],
    ] as const) {
      const r = await authorize(authParams(challenge, extra), { email: "x@y.z" });
      assert.equal(r.kind, "redirect");
      if (r.kind !== "redirect") continue;
      const u = new URL(r.url);
      assert.equal(u.searchParams.get("error"), error, JSON.stringify(extra));
      assert.equal(u.searchParams.get("state"), "st-123");
      assert.equal(u.searchParams.get("iss"), "https://lumeramd.biz");
      assert.ok(!u.searchParams.get("code"));
    }
    const noPkce = new URLSearchParams(authParams(challenge));
    noPkce.delete("code_challenge");
    const missing = await authorize(noPkce, { email: "x@y.z" });
    assert.equal(missing.kind === "redirect" && new URL(missing.url).searchParams.get("error"), "invalid_request");
    ok("a request without PKCE, with the wrong response type or without the openid scope is turned back with a standard error");

    const first = await member("a");
    const nobody = await authorize(authParams(challenge), null);
    assert.equal(nobody.kind, "login");
    assert.ok(nobody.kind === "login" && safeOidcNext(nobody.next), "the return path is one we allow");
    const silent = await authorize(authParams(challenge, { prompt: "none" }), null);
    assert.equal(silent.kind === "redirect" && new URL(silent.url).searchParams.get("error"), "login_required");
    const stranger = await authorize(authParams(challenge), { email: `${TAG}-unknown@example.test` });
    assert.equal(stranger.kind === "redirect" && new URL(stranger.url).searchParams.get("error"), "access_denied");
    ok("someone not signed in is sent to log in first; prompt=none gets login_required; a stranger gets access_denied");

    // ---- the whole flow ----
    const { code, verifier, url } = await getCode(first.email.toLowerCase());
    assert.equal(url.origin + url.pathname, REDIRECT);
    assert.equal(url.searchParams.get("state"), "st-123");
    assert.equal(url.searchParams.get("iss"), "https://lumeramd.biz");

    const exchanged = await exchangeCode(tokenForm(code, verifier), basic(CLIENT_ID, SECRET));
    assert.equal(exchanged.ok, true);
    if (!exchanged.ok) throw new Error("unreachable");
    const body = exchanged.body as { access_token: string; id_token: string; token_type: string; expires_in: number };
    assert.deepEqual([body.token_type, body.expires_in], ["Bearer", 3600]);

    // Check the ID token like a real client: signature against the published key, then the claims.
    const [h, p, s] = body.id_token.split(".");
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    assert.deepEqual([header.alg, header.kid], ["RS256", jwks.keys[0].kid]);
    const publicKey = crypto.createPublicKey({ key: jwks.keys[0], format: "jwk" });
    assert.ok(crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, "base64url")), "signature verifies with the published key");
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    assert.equal(claims.iss, "https://lumeramd.biz");
    assert.equal(claims.aud, CLIENT_ID);
    assert.equal(claims.sub, first.id);
    assert.equal(claims.email, first.email);
    assert.equal(claims.email_verified, true);
    assert.equal(claims.nonce, "nonce-456");
    assert.equal(claims.exp - claims.iat, 600);
    assert.ok(!("name" in claims), "no name unless the profile scope is asked for");
    assert.ok(!JSON.stringify(claims).includes("customer_basic"), "no plan or tier in the token: that comes from the API");
    const tampered = `${h}.${Buffer.from(JSON.stringify({ ...claims, sub: "someone-else" })).toString("base64url")}.${s}`.split(".");
    assert.ok(!crypto.verify("RSA-SHA256", Buffer.from(`${tampered[0]}.${tampered[1]}`), publicKey, Buffer.from(tampered[2], "base64url")));
    ok("the ID token is signed, names the member and email, echoes the nonce and shows no plan; a tampered one fails");

    const info = await userInfo(body.access_token);
    assert.deepEqual(info, { sub: first.id, email: first.email, email_verified: true });
    assert.equal(await userInfo("garbage"), null);
    ok("the user-info endpoint answers for a valid access token and refuses anything else");

    const profile = await getCode(first.email, { scope: "openid profile email extra" });
    const withProfile = await exchangeCode(tokenForm(profile.code, profile.verifier), basic(CLIENT_ID, SECRET));
    assert.equal(withProfile.ok, true);
    if (withProfile.ok) {
      const c = JSON.parse(Buffer.from(String(withProfile.body.id_token).split(".")[1], "base64url").toString());
      assert.deepEqual([c.given_name, c.family_name, c.name], ["Jane", "Testera", "Jane Testera"]);
      assert.equal(withProfile.body.scope, "openid profile email");
    }
    ok("asking for the profile scope adds the member's name; unknown scopes are ignored");

    // ---- client authentication ----
    const a = await getCode(first.email);
    for (const [label, auth, form] of [
      ["no credentials", null, tokenForm(a.code, a.verifier)],
      ["wrong secret", basic(CLIENT_ID, "wrong"), tokenForm(a.code, a.verifier)],
      ["wrong client id", basic("other", SECRET), tokenForm(a.code, a.verifier)],
      ["empty secret", basic(CLIENT_ID, ""), tokenForm(a.code, a.verifier)],
    ] as const) {
      const r = await exchangeCode(form, auth);
      assert.deepEqual([r.ok, !r.ok && r.error, !r.ok && r.status], [false, "invalid_client", 401], label);
    }
    const viaPost = await exchangeCode(tokenForm(a.code, a.verifier, { client_id: CLIENT_ID, client_secret: SECRET }), null);
    assert.equal(viaPost.ok, true);
    ok("the portal must prove itself with its secret; both the header and the form body are accepted");

    // ---- the code is protected ----
    const b = await getCode(first.email);
    const wrongVerifier = await exchangeCode(tokenForm(b.code, pkce().verifier), basic(CLIENT_ID, SECRET));
    assert.deepEqual([wrongVerifier.ok, !wrongVerifier.ok && wrongVerifier.error], [false, "invalid_grant"]);
    const wrongRedirect = await exchangeCode(tokenForm(b.code, b.verifier, { redirect_uri: "https://portal.lumeramd.com/other" }), basic(CLIENT_ID, SECRET));
    assert.equal(wrongRedirect.ok, false);
    const noGrantType = await exchangeCode(tokenForm(b.code, b.verifier, { grant_type: "password" }), basic(CLIENT_ID, SECRET));
    assert.equal(!noGrantType.ok && noGrantType.error, "unsupported_grant_type");
    assert.equal((await exchangeCode(tokenForm("not-a-code", b.verifier), basic(CLIENT_ID, SECRET))).ok, false);
    assert.equal((await exchangeCode(tokenForm(b.code, "short"), basic(CLIENT_ID, SECRET))).ok, false);
    ok("a code is useless without the right PKCE verifier and return address; unknown codes and other grant types are refused");

    await prisma.oidcGrant.updateMany({ where: { customerId: first.id, codeUsedAt: null, redirectUri: REDIRECT }, data: { codeExpiresAt: new Date(Date.now() - 1000) } });
    const expired = await exchangeCode(tokenForm(b.code, b.verifier), basic(CLIENT_ID, SECRET));
    assert.deepEqual([expired.ok, !expired.ok && expired.description], [false, "The code has expired."]);
    ok("a code expires after about a minute");

    const c = await getCode(first.email);
    const once = await exchangeCode(tokenForm(c.code, c.verifier), basic(CLIENT_ID, SECRET));
    assert.equal(once.ok, true);
    if (!once.ok) throw new Error("unreachable");
    assert.ok(await userInfo(String(once.body.access_token)));
    const replay = await exchangeCode(tokenForm(c.code, c.verifier), basic(CLIENT_ID, SECRET));
    assert.deepEqual([replay.ok, !replay.ok && replay.description], [false, "The code was already used."]);
    assert.equal(await userInfo(String(once.body.access_token)), null, "replaying a code cancels the token it produced");
    ok("a code works once; presenting it again is refused and cancels the access token it produced");

    const d = await getCode(first.email);
    const race = await Promise.all([
      exchangeCode(tokenForm(d.code, d.verifier), basic(CLIENT_ID, SECRET)),
      exchangeCode(tokenForm(d.code, d.verifier), basic(CLIENT_ID, SECRET)),
      exchangeCode(tokenForm(d.code, d.verifier), basic(CLIENT_ID, SECRET)),
    ]);
    assert.equal(race.filter((r) => r.ok).length, 1, "exactly one of three simultaneous exchanges wins");
    ok("three exchanges of the same code at the same moment: exactly one succeeds");

    // ---- who the member is ----
    const old = await member("old", { status: "cancelled", cancelledAt: new Date(), createdAt: new Date(Date.now() - 86_400_000 * 90) });
    const current = await member("old", { status: "active", activatedAt: new Date() }); // same email, newer, live membership
    assert.equal(old.email, current.email);
    const rejoined = await getCode(old.email.toUpperCase());
    const rejoinedTokens = await exchangeCode(tokenForm(rejoined.code, rejoined.verifier), basic(CLIENT_ID, SECRET));
    assert.equal(rejoinedTokens.ok, true);
    if (rejoinedTokens.ok) {
      const c2 = JSON.parse(Buffer.from(String(rejoinedTokens.body.id_token).split(".")[1], "base64url").toString());
      assert.equal(c2.sub, current.id, "the member id is the current membership's, the same one the API returns");
    }
    ok("the member id in the token is the current membership's id, the same rule as the membership API");

    // ---- the emailed link keeps its destination ----
    const loginNext = `/oauth/authorize?${authParams(challenge).toString()}`;
    const jsonReq = (b: object) =>
      new NextRequest("http://localhost/api/customers/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": `10.8.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
        body: JSON.stringify(b),
      });
    const realLog = console.log;
    console.log = () => {};
    try {
      await requestLoginLink(jsonReq({ email: first.email, next: loginNext }));
      await requestLoginLink(jsonReq({ email: first.email, next: "https://evil.example/steal" }));
    } finally {
      console.log = realLog;
    }
    const tokens = await prisma.customerLoginToken.findMany({ where: { customerId: first.id }, orderBy: { createdAt: "asc" } });
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].next, loginNext);
    assert.equal(tokens[1].next, null, "a login link can never be made to redirect off the site");
    for (const bad of ["https://evil.example", "//evil.example/oauth/authorize?x", "/account", "/oauth/authorize?x\r\nSet-Cookie: a=b", "/oauth/authorize?\\evil", 42, null, undefined]) {
      assert.equal(safeOidcNext(bad), null, String(bad));
    }
    assert.ok(safeOidcNext("/oauth/authorize?client_id=x&state=y"));
    ok("the emailed link remembers a sign-in to return to, and nothing else can be smuggled in as a destination");

    // ---- signing out ----
    const hint = rejoinedTokens.ok ? String(rejoinedTokens.body.id_token) : "";
    const out = (q: Record<string, string>) => logoutDestination(new URLSearchParams(q));
    assert.equal(out({ post_logout_redirect_uri: "https://portal.lumeramd.com/signed-out", client_id: CLIENT_ID, state: "s1" }), "https://portal.lumeramd.com/signed-out?state=s1");
    assert.equal(out({ post_logout_redirect_uri: "https://portal.lumeramd.com/signed-out", id_token_hint: hint }), "https://portal.lumeramd.com/signed-out");
    assert.equal(out({ post_logout_redirect_uri: "https://evil.example/", client_id: CLIENT_ID }), null);
    assert.equal(out({ post_logout_redirect_uri: "https://portal.lumeramd.com/signed-out" }), null, "no proof of who is asking");
    assert.equal(out({ post_logout_redirect_uri: "https://portal.lumeramd.com/signed-out", id_token_hint: `${hint.slice(0, -4)}AAAA` }), null);
    assert.equal(out({}), null);
    ok("after signing out the browser is sent only to an address we were told about, and only if the portal proves who it is");

    // ---- housekeeping ----
    await prisma.oidcGrant.updateMany({ where: { customerId: first.id }, data: { createdAt: new Date(Date.now() - 3 * 86_400_000) } });
    const purged = await purgeOidcGrants();
    assert.ok(purged.purged >= 1);
    assert.equal(await prisma.oidcGrant.count({ where: { customerId: first.id } }), 0);
    ok("old one-time codes and tokens are cleared out");

    say("\nAll single sign-on checks passed.");
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
