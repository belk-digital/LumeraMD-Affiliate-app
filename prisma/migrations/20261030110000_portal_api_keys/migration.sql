-- API keys for the customer portal's read API (only a hash of each key is stored).
CREATE TABLE "portal_api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "portal_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "portal_api_keys_keyHash_key" ON "portal_api_keys"("keyHash");
