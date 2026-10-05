-- CreateTable: the consultations a member has used (history shown in their account)
CREATE TABLE "member_consultations" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL DEFAULT 'Telehealth consultation',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_consultations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_consultations_customerId_occurredAt_idx" ON "member_consultations"("customerId", "occurredAt");

-- AddForeignKey
ALTER TABLE "member_consultations" ADD CONSTRAINT "member_consultations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_signups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
