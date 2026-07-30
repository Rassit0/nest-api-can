/*
  Warnings:

  - A unique constraint covering the columns `[receipt_series,receipt_number]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "transactions_receipt_number_key";

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "receipt_series" TEXT NOT NULL DEFAULT 'GEN',
ALTER COLUMN "receipt_number" DROP DEFAULT;
DROP SEQUENCE "transactions_receipt_number_seq";

-- CreateTable
CREATE TABLE "receipt_sequences" (
    "id" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "description" TEXT,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipt_sequences_series_key" ON "receipt_sequences"("series");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_receipt_series_receipt_number_key" ON "transactions"("receipt_series", "receipt_number");
