/*
  Warnings:

  - A unique constraint covering the columns `[player_membership_id,type,billingMonth,billingYear]` on the table `membership_charges` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "membership_charges" ADD COLUMN     "billingMonth" INTEGER,
ADD COLUMN     "billingYear" INTEGER;

-- AlterTable
ALTER TABLE "player_membership" ADD COLUMN     "nextMonthlyChargeGenerationDate" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "membership_charges_player_membership_id_type_billingMonth_b_key" ON "membership_charges"("player_membership_id", "type", "billingMonth", "billingYear");
