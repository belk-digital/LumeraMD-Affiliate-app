-- CreateTable: audit trail of admin moves in the hierarchy
CREATE TABLE "affiliate_moves" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "affiliateName" TEXT NOT NULL,
    "fromParentId" TEXT,
    "fromParentName" TEXT,
    "toParentId" TEXT,
    "toParentName" TEXT,
    "teamSize" INTEGER NOT NULL DEFAULT 0,
    "pendingOrdersUpdated" INTEGER NOT NULL DEFAULT 0,
    "movedByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_moves_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "affiliate_moves_affiliateId_idx" ON "affiliate_moves"("affiliateId");
CREATE INDEX "affiliate_moves_createdAt_idx" ON "affiliate_moves"("createdAt");
