import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, requests: number, window: `${number} ${"s" | "m" | "h"}`) {
  if (!redis) return null;
  const key = `${name}:${requests}:${window}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: `ratelimit:${name}`,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

/**
 * Checks a rate limit for the given (name, identifier) pair. If Upstash env
 * vars aren't configured (e.g. local dev without a Redis instance), this
 * fails open and allows the request — never blocks dev on missing infra.
 */
export async function checkRateLimit(
  name: string,
  identifier: string,
  requests: number,
  window: `${number} ${"s" | "m" | "h"}`,
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const limiter = getLimiter(name, requests, window);
  if (!limiter) return { ok: true };

  const result = await limiter.limit(identifier);
  if (result.success) return { ok: true };

  const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return { ok: false, retryAfterSeconds };
}

/** Best-effort client IP from standard proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
