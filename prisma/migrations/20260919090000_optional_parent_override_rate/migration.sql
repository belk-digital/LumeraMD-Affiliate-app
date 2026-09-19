-- A blank per-affiliate override rate now means "use the program default".
-- Existing rows keep the value they already have.
ALTER TABLE "affiliates" ALTER COLUMN "parentOverrideRate" DROP NOT NULL,
ALTER COLUMN "parentOverrideRate" DROP DEFAULT;
