-- AlterTable
ALTER TABLE "charges" ADD COLUMN     "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_reason" TEXT;
