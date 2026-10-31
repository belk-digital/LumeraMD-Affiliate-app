import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CustomerSignup } from "@/generated/prisma/client";
import { findMembershipByEmail } from "@/lib/customers/lookup";
import {
  SUPPORTED_SCOPES,
  oidcClientId,
  oidcConfigured,
  oidcIssuer,
  oidcPostLogoutUris,
  oidcRedirectUris,
  sha256Hex,
  verifyClientSecret,
} from "@/lib/oidc/config";
import { readOwnJwt, signJwt } from "@/lib/oidc/jwt";

// The rules of the sign-in. It is the standard authorization code flow with PKCE:
//   1. the portal sends the member here (authorize) with a code challenge
//   2. if they aren't signed in they sign in with the emailed link, then come straight back
//   3. we send them to the portal's return address with a one-time code
//   4. the portal's server swaps the code for tokens (token), proving it with its secret and the
//      PKCE verifier, and reads who signed in from the ID token
// Anything that could redirect to an address we haven't been told about is refused outright.

const CODE_TTL_MS = 60_000;
const ACCESS_TTL_S = 3600;
const ID_TOKEN_TTL_S = 600;

const token = () => crypto.randomBytes(32).toString("base64url");

export type AuthorizeResult =
  | { kind: "page"; status: number; message: string } // can't safely redirect anywhere: show this
  | { kind: "redirect"; url: string } // back to the portal, with a code or an error
  | { kind: "login"; next: string }; // the member must sign in first, then return to `next`

/** Handles the sign-in request. `session` is who is signed in on this site right now, if anyone. */
export async function authorize(
  params: URLSearchParams,
  session: { email: string } | null,
): Promise<AuthorizeResult> {
  if (!oidcConfigured()) return { kind: "page", status: 503, message: "Single sign-on isn't set up yet." };

  // Until the client and return address check out, never redirect: that would be an open redirect.
  const redirectUri = params.get("redirect_uri") ?? "";
  if (params.get("client_id") !== oidcClientId() || !oidcRedirectUris().includes(redirectUri)) {
    return { kind: "page", status: 400, message: "This sign-in request isn't valid: unknown application or return address." };
  }

  const state = params.get("state");
  const back = (extra: Record<string, string>): AuthorizeResult => {
    const url = new URL(redirectUri);
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
    if (state) url.searchParams.set("state", state);
    url.searchParams.set("iss", oidcIssuer());
    return { kind: "redirect", url: url.toString() };
  };
  const fail = (error: string, description: string) => back({ error, error_description: description });

  if (state && state.length > 512) return fail("invalid_request", "state is too long.");
  if (params.get("response_type") !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");

  const scopes = (params.get("scope") ?? "").split(/\s+/).filter(Boolean);
  if (!scopes.includes("openid")) return fail("invalid_scope", "The openid scope is required.");
  const scope = scopes.filter((s) => (SUPPORTED_SCOPES as readonly string[]).includes(s)).join(" ");

  const challenge = params.get("code_challenge") ?? "";
  if (params.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
    return fail("invalid_request", "PKCE is required: send code_challenge and code_challenge_method=S256.");
  }
  const nonce = params.get("nonce");
  if (nonce && nonce.length > 256) return fail("invalid_request", "nonce is too long.");

  if (!session) {
    if ((params.get("prompt") ?? "").split(/\s+/).includes("none")) {
      return fail("login_required", "The member is not signed in.");
    }
    return { kind: "login", next: `/oauth/authorize?${params.toString()}` };
  }

  // The same rule as the membership API: their current membership, else their latest one.
  const member = await findMembershipByEmail(session.email);
  if (!member) return fail("access_denied", "No membership was found for this account.");

  const code = token();
  await prisma.oidcGrant.create({
    data: {
      codeHash: sha256Hex(code),
      clientId: oidcClientId(),
      customerId: member.id,
      email: member.email,
      redirectUri,
      codeChallenge: challenge,
      nonce: nonce || null,
      scope,
      codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return back({ code });
}

type TokenResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: 400 | 401; error: string; description: string; basic?: boolean };

/** Claims about the member, limited to what the requested scopes allow. */
function claimsFor(member: CustomerSignup, scope: string) {
  const scopes = scope.split(" ");
  return {
    sub: member.id,
    ...(scopes.includes("email") ? { email: member.email, email_verified: true } : {}),
    ...(scopes.includes("profile")
      ? {
          name: `${member.firstName} ${member.lastName}`.trim(),
          given_name: member.firstName,
          family_name: member.lastName,
        }
      : {}),
  };
}

const formDecode = (s: string) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
};

/** Pulls the client's credentials from the Authorization header (preferred) or the form body. */
function clientCredentials(authorization: string | null, form: URLSearchParams) {
  if (authorization?.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(authorization.slice(6).trim(), "base64").toString("utf8");
    const at = decoded.indexOf(":");
    if (at > 0) return { id: formDecode(decoded.slice(0, at)), secret: formDecode(decoded.slice(at + 1)), basic: true };
  }
  return { id: form.get("client_id") ?? "", secret: form.get("client_secret") ?? "", basic: false };
}

/** Swaps a one-time code for tokens. */
export async function exchangeCode(form: URLSearchParams, authorization: string | null): Promise<TokenResult> {
  if (!oidcConfigured()) return { ok: false, status: 400, error: "invalid_request", description: "Single sign-on isn't set up yet." };

  const client = clientCredentials(authorization, form);
  if (client.id !== oidcClientId() || !client.secret || !verifyClientSecret(client.secret)) {
    return { ok: false, status: 401, error: "invalid_client", description: "Client authentication failed.", basic: client.basic };
  }
  if (form.get("grant_type") !== "authorization_code") {
    return { ok: false, status: 400, error: "unsupported_grant_type", description: "Only authorization_code is supported." };
  }
  const bad = (description: string): TokenResult => ({ ok: false, status: 400, error: "invalid_grant", description });

  const code = form.get("code") ?? "";
  const verifier = form.get("code_verifier") ?? "";
  if (!code || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return bad("code and a valid code_verifier are required.");

  const grant = await prisma.oidcGrant.findUnique({ where: { codeHash: sha256Hex(code) } });
  if (!grant || grant.clientId !== client.id) return bad("The code is not valid.");

  // A code that is presented twice means it leaked: kill the tokens it already produced.
  if (grant.codeUsedAt) {
    await prisma.oidcGrant.update({ where: { id: grant.id }, data: { accessExpiresAt: new Date() } });
    return bad("The code was already used.");
  }
  if (grant.codeExpiresAt < new Date()) return bad("The code has expired.");
  if (form.get("redirect_uri") !== grant.redirectUri) return bad("redirect_uri does not match the sign-in request.");

  const expected = Buffer.from(grant.codeChallenge);
  const actual = Buffer.from(crypto.createHash("sha256").update(verifier).digest("base64url"));
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return bad("code_verifier does not match.");

  const member = await prisma.customerSignup.findUnique({ where: { id: grant.customerId } });
  if (!member) return bad("The member no longer exists.");

  const accessToken = token();
  // Only one request can win the code, even if two arrive together.
  const claimed = await prisma.oidcGrant.updateMany({
    where: { id: grant.id, codeUsedAt: null },
    data: {
      codeUsedAt: new Date(),
      accessHash: sha256Hex(accessToken),
      accessExpiresAt: new Date(Date.now() + ACCESS_TTL_S * 1000),
    },
  });
  if (claimed.count === 0) return bad("The code was already used.");

  const now = Math.floor(Date.now() / 1000);
  const idToken = signJwt({
    iss: oidcIssuer(),
    aud: client.id,
    iat: now,
    exp: now + ID_TOKEN_TTL_S,
    ...(grant.nonce ? { nonce: grant.nonce } : {}),
    ...claimsFor(member, grant.scope),
  });

  return {
    ok: true,
    body: { access_token: accessToken, token_type: "Bearer", expires_in: ACCESS_TTL_S, id_token: idToken, scope: grant.scope },
  };
}

/** The member's claims for a valid access token, or null. */
export async function userInfo(accessToken: string) {
  if (!oidcConfigured() || !accessToken) return null;
  const grant = await prisma.oidcGrant.findUnique({ where: { accessHash: sha256Hex(accessToken) } });
  if (!grant || !grant.accessExpiresAt || grant.accessExpiresAt < new Date()) return null;
  const member = await prisma.customerSignup.findUnique({ where: { id: grant.customerId } });
  return member ? claimsFor(member, grant.scope) : null;
}

/**
 * Sign-out request. Returns where to send the browser afterwards, or null to show our own page.
 * The portal may only ask for an address we were told about, and must prove who it is with either
 * the ID token we issued or its client id.
 */
export function logoutDestination(params: URLSearchParams): string | null {
  if (!oidcConfigured()) return null;
  const target = params.get("post_logout_redirect_uri");
  if (!target || !oidcPostLogoutUris().includes(target)) return null;

  const hint = params.get("id_token_hint");
  const claims = hint ? readOwnJwt(hint) : null;
  const knownClient = claims ? claims.aud === oidcClientId() : params.get("client_id") === oidcClientId();
  if (!knownClient) return null;

  const url = new URL(target);
  const state = params.get("state");
  if (state && state.length <= 512) url.searchParams.set("state", state);
  return url.toString();
}

/** Housekeeping: one-time codes and tokens older than two days are of no use. */
export async function purgeOidcGrants() {
  const { count } = await prisma.oidcGrant.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } } });
  return { purged: count };
}
