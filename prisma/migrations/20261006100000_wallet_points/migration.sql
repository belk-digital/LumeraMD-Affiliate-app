-- CreateEnum
CREATE TYPE "WalletKind" AS ENUM ('customer', 'affiliate');

-- CreateEnum
CREATE TYPE "WalletTxType" AS ENUM ('earn', 'redeem', 'refund', 'clawback', 'adjustment');

-- CreateEnum
CREATE TYPE "WalletRedemptionStatus" AS ENUM ('pending', 'used', 'expired');

-- AlterTable: wallet rules (off until an admin enables them)
ALTER TABLE "affiliate_settings"
  ADD COLUMN "walletEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "walletOrderEarnPercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
  ADD COLUMN "walletOrderMinSubtotal" DOUBLE PRECISION NOT NULL DEFAULT 300,
  ADD COLUMN "walletMembershipEarnPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "walletMinRedeem" DOUBLE PRECISION NOT NULL DEFAULT 5,
  ADD COLUMN "walletRedeemExpiryDays" INTEGER NOT NULL DEFAULT 14;

-- CreateTable
CREATE TABLE "wallet_accounts" (
    "id" TEXT NOT NULL,
    "kind" "WalletKind" NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("id"),
    -- A balance can never be negative, whatever the application does.
    CONSTRAINT "wallet_accounts_balance_nonnegative" CHECK ("balanceCents" >= 0)
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "WalletTxType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "balanceAfterCents" INTEGER NOT NULL,
    "reason" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "idempotencyKey" TEXT,
    "meta" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_redemptions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" "WalletRedemptionStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_accounts_kind_ownerKey_key" ON "wallet_accounts"("kind", "ownerKey");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_idempotencyKey_key" ON "wallet_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "wallet_transactions_accountId_createdAt_idx" ON "wallet_transactions"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_transactions_sourceType_sourceId_idx" ON "wallet_transactions"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_redemptions_code_key" ON "wallet_redemptions"("code");

-- CreateIndex
CREATE INDEX "wallet_redemptions_accountId_status_idx" ON "wallet_redemptions"("accountId", "status");

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "wallet_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_redemptions" ADD CONSTRAINT "wallet_redemptions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "wallet_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
