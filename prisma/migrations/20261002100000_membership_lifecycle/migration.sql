-- AlterEnum: a membership whose payment lapsed
ALTER TYPE "CustomerSignupStatus" ADD VALUE 'past_due';

-- AlterTable: membership lifecycle columns
ALTER TABLE "customer_signups"
  ADD COLUMN "activatedAt" TIMESTAMP(3),
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "memberDiscountCode" TEXT,
  ADD COLUMN "memberDiscountActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "consultationsUsed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: whether membership payments earn the referring rep commission (off by default)
ALTER TABLE "affiliate_settings"
  ADD COLUMN "membershipCommissionEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "membership_payments" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_login_tokens" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_signups_memberDiscountCode_key" ON "customer_signups"("memberDiscountCode");

-- CreateIndex
CREATE INDEX "membership_payments_customerId_createdAt_idx" ON "membership_payments"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "membership_payments_source_externalId_key" ON "membership_payments"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_login_tokens_token_key" ON "customer_login_tokens"("token");

-- AddForeignKey
ALTER TABLE "membership_payments" ADD CONSTRAINT "membership_payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_signups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_login_tokens" ADD CONSTRAINT "customer_login_tokens_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_signups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
