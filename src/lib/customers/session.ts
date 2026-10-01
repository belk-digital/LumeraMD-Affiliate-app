import crypto from "node:crypto";
import { cookies } from "next/headers";

// Customer (member) login session. Same signed-cookie scheme as the affiliate session, with its own
// cookie name and payload field, so a token from one can never be accepted as the other.
const COOKIE_NAME = "customer_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sign(value: string) {
  return crypto
    .createHmac("sha256", process.env.AFFILIATE_SESSION_SECRET!)
    .update(`customer:${value}`)
    .digest("hex");
}

export interface CustomerSession {
  customerId: string;
  email: string;
}

function createSessionToken(session: CustomerSession): string {
  const payload = JSON.stringify({ ...session, exp: Date.now() + SESSION_TTL_MS });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function parseSessionToken(token: string): CustomerSession | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = Buffer.from(sign(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (
      typeof payload.customerId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.exp !== "number" ||
      Date.now() > payload.exp
    ) {
      return null;
    }
    return { customerId: payload.customerId, email: payload.email };
  } catch {
    return null;
  }
}

export async function setCustomerSessionCookie(session: CustomerSession) {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(session), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return token ? parseSessionToken(token) : null;
}

export async function clearCustomerSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
