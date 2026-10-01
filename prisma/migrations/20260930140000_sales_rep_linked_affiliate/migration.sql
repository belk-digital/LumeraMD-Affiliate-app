-- AlterTable: link an approved sales rep signup to the affiliate created from it
ALTER TABLE "sales_rep_signups" ADD COLUMN "linkedAffiliateId" TEXT;
