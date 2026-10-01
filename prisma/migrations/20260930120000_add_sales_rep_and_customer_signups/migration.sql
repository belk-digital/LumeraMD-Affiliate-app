-- CreateEnum
CREATE TYPE "CustomerSignupStatus" AS ENUM ('pending_payment', 'active', 'cancelled');

-- CreateTable
CREATE TABLE "sales_rep_signups" (
    "id" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "annualGrossSales" DOUBLE PRECISION,
    "salesType" TEXT,
    "resumeStorageKey" TEXT,
    "resumeFileName" TEXT,
    "resumeFileType" TEXT,
    "referredByAffiliateId" TEXT,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'pending',
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_rep_signups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_signups" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "plan" TEXT NOT NULL,
    "wantsTestKit" BOOLEAN NOT NULL DEFAULT false,
    "referredByAffiliateId" TEXT,
    "status" "CustomerSignupStatus" NOT NULL DEFAULT 'pending_payment',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_signups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_rep_signups_email_idx" ON "sales_rep_signups"("email");

-- CreateIndex
CREATE INDEX "customer_signups_email_idx" ON "customer_signups"("email");
