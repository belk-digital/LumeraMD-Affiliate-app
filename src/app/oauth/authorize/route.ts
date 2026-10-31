import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customers/session";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { authorize } from "@/lib/oidc/provider";

export const dynamic = "force-dynamic";

const page = (status: number, message: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign-in problem · LumeraMD</title>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#1b222c">` +
      `<h1 style="font-size:1.4rem">We couldn't sign you in</h1><p>${message.replace(/[<>&"]/g, "")}</p>` +
      `<p><a href="/account/login" style="color:#17324E">Go to member login</a></p></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );

/** Step 1 of the sign-in: the portal sends the member here. */
export async function GET(req: NextRequest) {
  const limit = await checkRateLimit("oidc-authorize", getClientIp(req), 60, "1 m");
  if (!limit.ok) return page(429, "Too many sign-in attempts. Please wait a minute and try again.");

  const session = await getCustomerSession();
  const result = await authorize(req.nextUrl.searchParams, session);

  if (result.kind === "page") return page(result.status, result.message);
  if (result.kind === "login") {
    return NextResponse.redirect(new URL(`/account/login?next=${encodeURIComponent(result.next)}`, req.nextUrl.origin));
  }
  return NextResponse.redirect(result.url);
}
