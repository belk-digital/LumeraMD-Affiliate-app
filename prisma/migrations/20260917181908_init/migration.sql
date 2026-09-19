-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('pending', 'approved', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "CommissionOn" AS ENUM ('subtotal_before_coupon', 'subtotal_after_coupon');

-- CreateEnum
CREATE TYPE "ClickSource" AS ENUM ('referral_link', 'coupon_code_attempt');

-- CreateEnum
CREATE TYPE "AttributionSource" AS ENUM ('referral_link', 'coupon_code', 'both');

-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('pending', 'approved', 'paid', 'reversed', 'voided');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'approved', 'paid', 'rejected');

-- CreateTable
CREATE TABLE "affiliates" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'pending',
    "referralSlug" TEXT NOT NULL,
    "shopifyDiscountCode" TEXT,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "commissionType" "CommissionType" NOT NULL DEFAULT 'percent',
    "commissionOn" "CommissionOn" NOT NULL DEFAULT 'subtotal_after_coupon',
    "cookieDurationDays" INTEGER NOT NULL DEFAULT 30,
    "pendingPeriodDays" INTEGER NOT NULL DEFAULT 30,
    "minimumPayoutThreshold" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "payoutMethod" TEXT,
    "payoutDetails" JSONB,
    "parentAffiliateId" TEXT,
    "parentOverrideRate" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "fraudScore" INTEGER NOT NULL DEFAULT 0,
    "fraudNotes" TEXT,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "totalConversions" INTEGER NOT NULL DEFAULT 0,
    "totalCommissionEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCommissionPending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCommissionApproved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCommissionPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_clicks" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "source" "ClickSource" NOT NULL DEFAULT 'referral_link',
    "ipHash" TEXT,
    "deviceType" TEXT,
    "referrer" TEXT,
    "sessionId" TEXT,
    "convertedToOrder" BOOLEAN NOT NULL DEFAULT false,
    "conversionId" TEXT,
    "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_conversions" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "shopifyOrderName" TEXT,
    "attributionSource" "AttributionSource" NOT NULL,
    "attributionClickId" TEXT,
    "orderSubtotal" DOUBLE PRECISION NOT NULL,
    "orderDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eligibleSubtotal" DOUBLE PRECISION NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "parentAffiliateId" TEXT,
    "parentCommissionRate" DOUBLE PRECISION,
    "parentCommissionAmount" DOUBLE PRECISION,
    "status" "ConversionStatus" NOT NULL DEFAULT 'pending',
    "pendingUntil" TIMESTAMP(3),
    "reversedReason" TEXT,
    "selfReferralDetected" BOOLEAN NOT NULL DEFAULT false,
    "ipMatchesAffiliate" BOOLEAN NOT NULL DEFAULT false,
    "fraudScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_payouts" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "conversionIds" TEXT[],
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "payoutMethod" TEXT,
    "payoutDetails" JSONB,
    "transactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_applications" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "socialLinks" JSONB,
    "promotionMethods" TEXT,
    "estimatedMonthlyReach" TEXT,
    "niche" TEXT,
    "agreedToTerms" BOOLEAN NOT NULL DEFAULT false,
    "referredByAffiliateId" TEXT,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'pending',
    "reviewNotes" TEXT,
    "linkedAffiliateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "defaultCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "defaultCommissionType" "CommissionType" NOT NULL DEFAULT 'percent',
    "defaultCommissionOn" "CommissionOn" NOT NULL DEFAULT 'subtotal_after_coupon',
    "defaultCookieDurationDays" INTEGER NOT NULL DEFAULT 30,
    "defaultPendingPeriodDays" INTEGER NOT NULL DEFAULT 30,
    "defaultMinimumPayoutThreshold" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "defaultParentOverrideRate" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_userEmail_key" ON "affiliates"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_referralSlug_key" ON "affiliates"("referralSlug");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_shopifyDiscountCode_key" ON "affiliates"("shopifyDiscountCode");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_clicks_conversionId_key" ON "affiliate_clicks"("conversionId");

-- CreateIndex
CREATE INDEX "affiliate_clicks_affiliateId_idx" ON "affiliate_clicks"("affiliateId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_conversions_shopifyOrderId_key" ON "affiliate_conversions"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "affiliate_conversions_affiliateId_idx" ON "affiliate_conversions"("affiliateId");

-- CreateIndex
CREATE INDEX "affiliate_payouts_affiliateId_idx" ON "affiliate_payouts"("affiliateId");

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_parentAffiliateId_fkey" FOREIGN KEY ("parentAffiliateId") REFERENCES "affiliates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_parentAffiliateId_fkey" FOREIGN KEY ("parentAffiliateId") REFERENCES "affiliates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
