/*
  Warnings:

  - A unique constraint covering the columns `[receipt_number]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "receipt_number" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_receipt_number_key" ON "transactions"("receipt_number");
