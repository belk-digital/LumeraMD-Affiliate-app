import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { exchangeCode } from "@/lib/oidc/provider";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };

/** Step 2: the portal's server swaps the one-time code for tokens. */
export async function POST(req: NextRequest) {
  const limit = await checkRateLimit("oidc-token", getClientIp(req), 30, "1 m");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Too many requests." },
      { status: 429, headers: { ...noStore, "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const form = new URLSearchParams(await req.text());
  const result = await exchangeCode(form, req.headers.get("authorization"));
  if (result.ok) return NextResponse.json(result.body, { headers: noStore });

  return NextResponse.json(
    { error: result.error, error_description: result.description },
    { status: result.status, headers: { ...noStore, ...(result.basic ? { "WWW-Authenticate": 'Basic realm="LumeraMD"' } : {}) } },
  );
}
