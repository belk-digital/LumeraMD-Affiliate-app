-- Outgoing membership notifications for the customer portal integration (retryable delivery log).
CREATE TABLE "portal_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "portal_events_status_nextAttemptAt_idx" ON "portal_events"("status", "nextAttemptAt");
CREATE INDEX "portal_events_customerId_idx" ON "portal_events"("customerId");
