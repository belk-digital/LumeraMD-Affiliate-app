import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "affiliate_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sign(value: string) {
  return crypto
    .createHmac("sha256", process.env.AFFILIATE_SESSION_SECRET!)
    .update(value)
    .digest("hex");
}

export interface AffiliateSession {
  affiliateId: string;
  email: string;
}

function createSessionToken(session: AffiliateSession): string {
  const payload = JSON.stringify({ ...session, exp: Date.now() + SESSION_TTL_MS });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function parseSessionToken(token: string): AffiliateSession | null {
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
      typeof payload.affiliateId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.exp !== "number" ||
      Date.now() > payload.exp
    ) {
      return null;
    }
    return { affiliateId: payload.affiliateId, email: payload.email };
  } catch {
    return null;
  }
}

export async function setAffiliateSessionCookie(session: AffiliateSession) {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(session), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

async function readSessionCookie(): Promise<AffiliateSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return token ? parseSessionToken(token) : null;
}

/**
 * The signed-in affiliate, or null. A session lasts 30 days, so the account is checked every time:
 * someone suspended (or removed) after they signed in is treated as signed out straight away,
 * on pages and API calls alike.
 */
export async function getAffiliateSession(): Promise<AffiliateSession | null> {
  const session = await readSessionCookie();
  if (!session) return null;
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: session.affiliateId },
    select: { status: true },
  });
  return affiliate?.status === "approved" ? session : null;
}

/** Someone still holding a valid sign-in whose account is no longer approved, so they can be told why. */
export async function getInactiveAffiliate() {
  const session = await readSessionCookie();
  if (!session) return null;
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: session.affiliateId },
    select: { id: true, status: true, suspendReason: true },
  });
  return affiliate && affiliate.status !== "approved" ? affiliate : null;
}

export async function clearAffiliateSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
