import crypto from "node:crypto";
import { oidcIssuer, oidcSigningKey } from "@/lib/oidc/config";

const b64 = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/** Signs claims as an RS256 JWT with the configured key. */
export function signJwt(claims: Record<string, unknown>): string {
  const key = oidcSigningKey();
  if (!key) throw new Error("Single sign-on has no signing key.");
  const input = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT", kid: key.kid }))}.${b64(JSON.stringify(claims))}`;
  return `${input}.${crypto.sign("RSA-SHA256", Buffer.from(input), key.privateKey).toString("base64url")}`;
}

/**
 * Checks that a token was signed by us and names us as issuer. Expiry is deliberately ignored: this
 * is for the `id_token_hint` of a sign-out request, which is normally an old token.
 */
export function readOwnJwt(token: string): Record<string, unknown> | null {
  const key = oidcSigningKey();
  const [header, payload, signature] = token.split(".");
  if (!key || !header || !payload || !signature) return null;
  try {
    const head = JSON.parse(Buffer.from(header, "base64url").toString());
    if (head.alg !== "RS256" || (head.kid && head.kid !== key.kid)) return null;
    const valid = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${header}.${payload}`),
      crypto.createPublicKey(key.privateKey),
      Buffer.from(signature, "base64url"),
    );
    if (!valid) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    return claims.iss === oidcIssuer() ? claims : null;
  } catch {
    return null;
  }
}
