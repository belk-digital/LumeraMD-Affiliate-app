import crypto from "node:crypto";

// Single sign-on ("Sign in with LumeraMD"): this site acts as an OpenID Connect provider for one
// registered client, the customer portal. Everything is configured by environment variables so the
// private key and the client secret never touch the database or the code:
//
//   OIDC_PRIVATE_KEY          RSA private key (PEM, PKCS#8), with line breaks written as \n
//   OIDC_CLIENT_SECRET_SHA256 SHA-256 (hex) of the client secret. The secret itself is never stored
//   OIDC_REDIRECT_URIS        comma-separated return addresses the client may use (exact match)
//   OIDC_POST_LOGOUT_URIS     optional: addresses we may send the browser to after signing out
//   OIDC_CLIENT_ID            optional, defaults to "lumeramd-portal"
//
// `scripts/setupOidc.ts` generates the key and the secret and prints the values to put in Vercel.

const split = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** The issuer, exactly as it appears in tokens and in the discovery document: no trailing slash. */
export const oidcIssuer = () => (process.env.APP_BASE_URL ?? "").trim().replace(/\/+$/, "");
export const oidcClientId = () => process.env.OIDC_CLIENT_ID?.trim() || "lumeramd-portal";
export const oidcRedirectUris = () => split(process.env.OIDC_REDIRECT_URIS);
export const oidcPostLogoutUris = () => split(process.env.OIDC_POST_LOGOUT_URIS);

export const SUPPORTED_SCOPES = ["openid", "email", "profile"] as const;

interface SigningKey {
  privateKey: crypto.KeyObject;
  publicJwk: { kty: string; n: string; e: string; kid: string; use: "sig"; alg: "RS256" };
  kid: string;
}

let cached: { source: string; key: SigningKey | null } | undefined;

/** The signing key, or null if none is configured or it isn't a usable RSA key. */
export function oidcSigningKey(): SigningKey | null {
  const source = process.env.OIDC_PRIVATE_KEY ?? "";
  if (cached && cached.source === source) return cached.key;

  let key: SigningKey | null = null;
  if (source.trim()) {
    try {
      const privateKey = crypto.createPrivateKey(source.replace(/\\n/g, "\n"));
      const jwk = crypto.createPublicKey(privateKey).export({ format: "jwk" });
      if (privateKey.asymmetricKeyType === "rsa" && jwk.n && jwk.e && (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048) {
        // The key id is the RFC 7638 thumbprint of the public key, so it changes only if the key does.
        const kid = crypto
          .createHash("sha256")
          .update(JSON.stringify({ e: jwk.e, kty: "RSA", n: jwk.n }))
          .digest("base64url");
        key = { privateKey, kid, publicJwk: { kty: "RSA", n: jwk.n, e: jwk.e, kid, use: "sig", alg: "RS256" } };
      }
    } catch {
      key = null;
    }
  }
  cached = { source, key };
  return key;
}

/** Single sign-on is on only when every piece is in place. */
export function oidcConfigured(): boolean {
  return (
    Boolean(oidcIssuer()) &&
    /^[0-9a-f]{64}$/.test((process.env.OIDC_CLIENT_SECRET_SHA256 ?? "").trim().toLowerCase()) &&
    oidcRedirectUris().length > 0 &&
    oidcSigningKey() !== null
  );
}

/** What is still missing before single sign-on can switch on, by the name of the setting (never the values). */
export function oidcMissing(): string[] {
  const missing: string[] = [];
  if (!oidcIssuer()) missing.push("APP_BASE_URL");
  if (!oidcSigningKey()) missing.push("OIDC_PRIVATE_KEY");
  if (!/^[0-9a-f]{64}$/.test((process.env.OIDC_CLIENT_SECRET_SHA256 ?? "").trim().toLowerCase())) missing.push("OIDC_CLIENT_SECRET_SHA256");
  if (oidcRedirectUris().length === 0) missing.push("OIDC_REDIRECT_URIS");
  return missing;
}

const sha256Hex = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/** Checks a presented client secret against the stored hash, in constant time. */
export function verifyClientSecret(secret: string): boolean {
  const expected = (process.env.OIDC_CLIENT_SECRET_SHA256 ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(sha256Hex(secret)), Buffer.from(expected));
}

export { sha256Hex };
