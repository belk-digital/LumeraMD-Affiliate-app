-- Store the applicant's uploaded W-9 file directly in this Postgres database instead of an
-- external blob storage service. Nothing has used w9FileUrl yet (feature was added and replaced
-- in the same session), so it's safe to drop rather than migrate data.
ALTER TABLE "affiliate_applications"
  DROP COLUMN "w9FileUrl",
  ADD COLUMN "w9FileData" BYTEA,
  ADD COLUMN "w9FileType" TEXT;
