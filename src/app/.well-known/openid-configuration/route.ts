import { oidcConfigured } from "@/lib/oidc/config";
import { discoveryDocument } from "@/lib/oidc/metadata";

// OpenID Connect discovery: lets the portal find every other address from this one.
export async function GET() {
  if (!oidcConfigured()) return Response.json({ error: "not_configured" }, { status: 404 });
  return Response.json(discoveryDocument(), {
    headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
