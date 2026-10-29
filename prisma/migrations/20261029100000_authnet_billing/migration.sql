-- Authorize.net billing: the saved card (customer profile) and the monthly subscription that renews it.
ALTER TABLE "customer_signups" ADD COLUMN "authnetCustomerProfileId" TEXT;
ALTER TABLE "customer_signups" ADD COLUMN "authnetPaymentProfileId" TEXT;
ALTER TABLE "customer_signups" ADD COLUMN "authnetSubscriptionId" TEXT;
CREATE UNIQUE INDEX "customer_signups_authnetSubscriptionId_key" ON "customer_signups"("authnetSubscriptionId");
