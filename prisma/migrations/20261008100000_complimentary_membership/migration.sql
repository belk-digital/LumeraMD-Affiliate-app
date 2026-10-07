-- AlterTable: admin-granted membership without payment
ALTER TABLE "customer_signups" ADD COLUMN     "complimentary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "complimentaryBy" TEXT,
ADD COLUMN     "complimentaryNote" TEXT;
