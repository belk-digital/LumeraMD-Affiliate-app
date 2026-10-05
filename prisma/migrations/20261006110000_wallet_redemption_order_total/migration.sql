-- AlterTable: the order total a wallet code was used on, for proportional refunds
ALTER TABLE "wallet_redemptions" ADD COLUMN "usedOrderTotalCents" INTEGER;
