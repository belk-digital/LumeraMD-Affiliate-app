-- CreateTable: admin-customized membership packages (a plan with no row uses the code defaults)
CREATE TABLE "membership_plan_configs" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPrice" DOUBLE PRECISION NOT NULL,
    "listPrice" DOUBLE PRECISION,
    "webDiscountPercent" INTEGER NOT NULL,
    "consultations" INTEGER NOT NULL,
    "testKitPrice" DOUBLE PRECISION,
    "overrideEligible" BOOLEAN NOT NULL,
    "benefits" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "membership_plan_configs_pkey" PRIMARY KEY ("key")
);

-- CreateTable: program-wide membership numbers
CREATE TABLE "membership_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "testKitPrice" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "membership_settings_pkey" PRIMARY KEY ("id")
);
