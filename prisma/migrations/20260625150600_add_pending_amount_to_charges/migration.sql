/*
  Warnings:

  - Added the required column `pending_amount` to the `charges` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "charges" ADD COLUMN     "pending_amount" DECIMAL(10,2) NOT NULL;
