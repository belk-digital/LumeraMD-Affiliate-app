import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { verifyPortalApiKey } from "@/lib/portal/keys";

// Access for the customer portal's read API: a bearer key created by an admin on the
// Lumera Ops "API & webhooks" page and stored there only as a hash.

/** Returns an error response if the request isn't allowed, or null if it is. */
export async function requirePortalKey(req: Request): Promise<NextResponse | null> {
  const limit = await checkRateLimit("portal-api", getClientIp(req), 300, "1 m");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const key = token ? await verifyPortalApiKey(token) : null;
  if (!key) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  return null;
}
