-- AlterTable: Rename columns
ALTER TABLE "charges" RENAME COLUMN "discount_amount" TO "adjustment_amount";
ALTER TABLE "charges" RENAME COLUMN "discount_reason" TO "adjustment_reason";

-- Data Migration: Invert signs for historical records to preserve financial consistency
UPDATE "charges"
SET "adjustment_amount" = -"adjustment_amount"
WHERE "adjustment_amount" > 0;
