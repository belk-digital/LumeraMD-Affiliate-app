import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

// API keys for the customer portal. A key looks like `lmd_live_<43 random characters>`. We keep only
// its SHA-256 hash: the key is shown once when it is created and can't be looked up again. A 256-bit
// random key doesn't need a slow password hash; a fast one is safe and keeps every API call cheap.

const KEY_PREFIX = "lmd_live_";

export const hashPortalKey = (key: string) => crypto.createHash("sha256").update(key).digest("hex");

/** Cheap shape check, so obviously wrong tokens never reach the database. */
export const looksLikePortalKey = (token: string) => /^lmd_live_[A-Za-z0-9_-]{43}$/.test(token);

export async function createPortalApiKey(name: string, createdBy?: string) {
  const token = `${KEY_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
  const record = await prisma.portalApiKey.create({
    data: {
      name: name.trim().slice(0, 80),
      prefix: token.slice(0, KEY_PREFIX.length + 4),
      keyHash: hashPortalKey(token),
      createdBy: createdBy ?? null,
    },
  });
  return { record, token };
}

/** Marks a key unusable straight away. Returns false if it doesn't exist. Already-revoked keys stay as they were. */
export async function revokePortalApiKey(id: string): Promise<boolean> {
  const key = await prisma.portalApiKey.findUnique({ where: { id } });
  if (!key) return false;
  if (!key.revokedAt) await prisma.portalApiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  return true;
}

/** Finds the live key for a presented token, or null. Remembers when it was last used (at most every 5 minutes). */
export async function verifyPortalApiKey(token: string) {
  if (!looksLikePortalKey(token)) return null;
  const key = await prisma.portalApiKey.findUnique({ where: { keyHash: hashPortalKey(token) } });
  if (!key || key.revokedAt) return null;
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 5 * 60_000) {
    await prisma.portalApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return key;
}
