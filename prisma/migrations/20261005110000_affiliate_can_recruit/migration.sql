-- AlterTable: admin control over whether an affiliate may recruit a team (existing affiliates stay allowed)
ALTER TABLE "affiliates" ADD COLUMN "canRecruit" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: default for newly approved affiliates
ALTER TABLE "affiliate_settings" ADD COLUMN "defaultCanRecruit" BOOLEAN NOT NULL DEFAULT true;
