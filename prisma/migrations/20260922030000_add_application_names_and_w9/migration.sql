-- Split the application's single name field into first/last (existing rows keep their
-- combined displayName; these are nullable so old rows aren't affected), and add columns
-- for the applicant's uploaded, signed W-9 form and its admin verification state.
ALTER TABLE "affiliate_applications"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "w9FileUrl" TEXT,
  ADD COLUMN "w9FileName" TEXT,
  ADD COLUMN "w9VerifiedAt" TIMESTAMP(3),
  ADD COLUMN "w9VerifiedBy" TEXT;
