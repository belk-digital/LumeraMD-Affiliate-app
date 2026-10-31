-- Single sign-on (OpenID Connect): where the emailed login link should lead, and the sign-in grants.
ALTER TABLE "customer_login_tokens" ADD COLUMN "next" TEXT;

CREATE TABLE "oidc_grants" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "nonce" TEXT,
    "scope" TEXT NOT NULL,
    "codeExpiresAt" TIMESTAMP(3) NOT NULL,
    "codeUsedAt" TIMESTAMP(3),
    "accessHash" TEXT,
    "accessExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oidc_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oidc_grants_codeHash_key" ON "oidc_grants"("codeHash");
CREATE UNIQUE INDEX "oidc_grants_accessHash_key" ON "oidc_grants"("accessHash");
CREATE INDEX "oidc_grants_createdAt_idx" ON "oidc_grants"("createdAt");
