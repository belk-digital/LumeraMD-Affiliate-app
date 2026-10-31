import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { userInfo } from "@/lib/oidc/provider";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const limit = await checkRateLimit("oidc-userinfo", getClientIp(req), 120, "1 m");
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  const header = req.headers.get("authorization") ?? "";
  const claims = header.toLowerCase().startsWith("bearer ") ? await userInfo(header.slice(7).trim()) : null;
  if (!claims) {
    return NextResponse.json(
      { error: "invalid_token" },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer error="invalid_token"', "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(claims, { headers: { "Cache-Control": "no-store" } });
}

/** Who the access token belongs to. */
export const GET = handle;
export const POST = handle;
