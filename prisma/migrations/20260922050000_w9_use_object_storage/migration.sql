-- Move the W-9 file out of Postgres (bytea) into Neon Object Storage. Nothing has used
-- w9FileData in production yet, so it's safe to drop rather than migrate/backfill.
ALTER TABLE "affiliate_applications"
  DROP COLUMN "w9FileData",
  ADD COLUMN "w9StorageKey" TEXT;
