-- New affiliates start with team recruiting off; an admin switches it on per affiliate.
-- Existing affiliates keep whatever they have today.
ALTER TABLE "affiliates" ALTER COLUMN "canRecruit" SET DEFAULT false;
ALTER TABLE "affiliate_settings" ALTER COLUMN "defaultCanRecruit" SET DEFAULT false;
UPDATE "affiliate_settings" SET "defaultCanRecruit" = false WHERE "id" = 'global';
