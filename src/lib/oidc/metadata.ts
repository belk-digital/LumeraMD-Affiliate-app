import { SUPPORTED_SCOPES, oidcIssuer, oidcSigningKey } from "@/lib/oidc/config";

/** The OpenID Connect discovery document: where everything is and what is supported. */
export function discoveryDocument() {
  const iss = oidcIssuer();
  return {
    issuer: iss,
    authorization_endpoint: `${iss}/oauth/authorize`,
    token_endpoint: `${iss}/oauth/token`,
    userinfo_endpoint: `${iss}/oauth/userinfo`,
    jwks_uri: `${iss}/.well-known/jwks.json`,
    end_session_endpoint: `${iss}/oauth/logout`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [...SUPPORTED_SCOPES],
    claims_supported: ["sub", "iss", "aud", "exp", "iat", "nonce", "email", "email_verified", "name", "given_name", "family_name"],
    authorization_response_iss_parameter_supported: true,
  };
}

export function jwksDocument() {
  const key = oidcSigningKey();
  return { keys: key ? [key.publicJwk] : [] };
}
