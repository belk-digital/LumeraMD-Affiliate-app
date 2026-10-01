-- AlterTable: unilevel plan settings (feature is off until an admin enables it)
ALTER TABLE "affiliate_settings"
  ADD COLUMN "unilevelEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "unilevelMinPersonalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "unilevelRequiredRecruits" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "unilevelActiveRecruitMinSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "unilevelSlotRates" DOUBLE PRECISION[] DEFAULT ARRAY[5, 3, 3, 3, 1]::DOUBLE PRECISION[],
  ADD COLUMN "unilevelSellerTiers" JSONB NOT NULL DEFAULT '[{"name":"New Sales Person","minMonthlySales":0,"rate":10},{"name":"Developing Producer","minMonthlySales":2500,"rate":15},{"name":"Top Seller Tier","minMonthlySales":10000,"rate":20}]';

-- CreateTable
CREATE TABLE "conversion_overrides" (
    "id" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversion_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversion_overrides_affiliateId_createdAt_idx" ON "conversion_overrides"("affiliateId", "createdAt");

-- CreateIndex
CREATE INDEX "conversion_overrides_conversionId_idx" ON "conversion_overrides"("conversionId");

-- AddForeignKey
ALTER TABLE "conversion_overrides" ADD CONSTRAINT "conversion_overrides_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "affiliate_conversions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_overrides" ADD CONSTRAINT "conversion_overrides_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
