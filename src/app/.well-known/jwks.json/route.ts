import { oidcConfigured } from "@/lib/oidc/config";
import { jwksDocument } from "@/lib/oidc/metadata";

// The public key the portal uses to check the signature of our ID tokens.
export async function GET() {
  if (!oidcConfigured()) return Response.json({ error: "not_configured" }, { status: 404 });
  return Response.json(jwksDocument(), {
    headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
