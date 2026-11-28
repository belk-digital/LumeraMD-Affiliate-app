-- The monthly price a member pays, fixed when they first pay, so a later change to a plan's price on the admin
-- Plans page applies to new signups only. Existing paying members are backfilled with the price they pay today.
ALTER TABLE "customer_signups" ADD COLUMN "lockedMonthlyPrice" DOUBLE PRECISION;

UPDATE "customer_signups"
SET "lockedMonthlyPrice" = CASE "plan"
    WHEN 'agent' THEN 79
    WHEN 'customer_basic' THEN 49
    WHEN 'customer_plus' THEN 79
    WHEN 'customer_premium' THEN 179
  END
WHERE "activatedAt" IS NOT NULL AND "complimentary" = false;
