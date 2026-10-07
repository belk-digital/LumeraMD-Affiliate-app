-- AlterTable: per-affiliate 90-day activity cycle state
ALTER TABLE "affiliates" ADD COLUMN     "activeUntil" TIMESTAMP(3),
ADD COLUMN     "cycleEndsAt" TIMESTAMP(3),
ADD COLUMN     "cycleStartedAt" TIMESTAMP(3),
ADD COLUMN     "cycleWarningStage" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: activity cycle program settings (off by default)
ALTER TABLE "affiliate_settings" ADD COLUMN     "activityCycleDays" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "activityEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "activityMinSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "activityRequiredRecruits" INTEGER NOT NULL DEFAULT 3;
