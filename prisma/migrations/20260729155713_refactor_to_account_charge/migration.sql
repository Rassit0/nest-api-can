/*
  Warnings:

  - You are about to drop the `account_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `accounts` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `type` on the `account_categories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ChargeDirection" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- DropForeignKey
ALTER TABLE "account_transactions" DROP CONSTRAINT "account_transactions_account_id_fkey";

-- DropForeignKey
ALTER TABLE "account_transactions" DROP CONSTRAINT "account_transactions_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "account_transactions" DROP CONSTRAINT "account_transactions_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "account_transactions" DROP CONSTRAINT "account_transactions_updated_by_id_fkey";

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_category_id_fkey";

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_person_id_fkey";

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_updated_by_id_fkey";

-- AlterTable
ALTER TABLE "account_categories" DROP COLUMN "type",
ADD COLUMN     "type" "ChargeDirection" NOT NULL;

-- AlterTable
ALTER TABLE "charges" ADD COLUMN     "direction" "ChargeDirection" NOT NULL DEFAULT 'RECEIVABLE';

-- DropTable
DROP TABLE "account_transactions";

-- DropTable
DROP TABLE "accounts";

-- DropEnum
DROP TYPE "AccountStatus";

-- DropEnum
DROP TYPE "AccountType";

-- CreateTable
CREATE TABLE "account_charges" (
    "id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category_id" TEXT,
    "reference_type" "AccountReferenceType",
    "reference_id" TEXT,
    "reference_number" TEXT,
    "person_id" TEXT,
    "external_entity" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "account_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_charges_charge_id_key" ON "account_charges"("charge_id");

-- CreateIndex
CREATE INDEX "account_charges_person_id_idx" ON "account_charges"("person_id");

-- CreateIndex
CREATE INDEX "account_charges_category_id_idx" ON "account_charges"("category_id");

-- AddForeignKey
ALTER TABLE "account_charges" ADD CONSTRAINT "account_charges_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_charges" ADD CONSTRAINT "account_charges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "account_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_charges" ADD CONSTRAINT "account_charges_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_charges" ADD CONSTRAINT "account_charges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_charges" ADD CONSTRAINT "account_charges_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
