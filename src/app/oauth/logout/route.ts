import { NextRequest, NextResponse } from "next/server";
import { clearCustomerSessionCookie } from "@/lib/customers/session";
import { logoutDestination } from "@/lib/oidc/provider";

export const dynamic = "force-dynamic";

/**
 * Sign-out (OpenID Connect RP-initiated logout). It signs the member out of lumeramd.biz and, if the
 * portal asked for an address we know and proved who it is, sends the browser back there.
 */
export async function GET(req: NextRequest) {
  await clearCustomerSessionCookie();

  const destination = logoutDestination(req.nextUrl.searchParams);
  if (destination) return NextResponse.redirect(destination);

  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signed out · LumeraMD</title>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#1b222c">` +
      `<h1 style="font-size:1.4rem">You've been signed out</h1><p>You are no longer signed in to your LumeraMD membership.</p>` +
      `<p><a href="/account/login" style="color:#17324E">Sign in again</a></p></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}
