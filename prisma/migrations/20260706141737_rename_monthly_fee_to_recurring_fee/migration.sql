/*
  Warnings:

  - You are about to drop the column `monthly_fee` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `monthly_fee` on the `team_seasons` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[player_membership_id,type,billingMonth,billingYear,billing_cycle]` on the table `membership_charges` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[student_membership_id,type,billingMonth,billingYear,billing_cycle]` on the table `student_charges` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('MONTHLY', 'WEEKLY', 'BIWEEKLY');

-- DropIndex
DROP INDEX "membership_charges_player_membership_id_type_billingMonth_b_key";

-- DropIndex
DROP INDEX "student_charges_student_membership_id_type_billingMonth_bil_key";

-- AlterTable
ALTER TABLE "course_seasons" DROP COLUMN "monthly_fee",
ADD COLUMN     "billing_frequency" "BillingFrequency" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "recurring_fee" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "membership_charges" ADD COLUMN     "billing_cycle" INTEGER;

-- AlterTable
ALTER TABLE "student_charges" ADD COLUMN     "billing_cycle" INTEGER;

-- AlterTable
ALTER TABLE "team_seasons" DROP COLUMN "monthly_fee",
ADD COLUMN     "billing_frequency" "BillingFrequency" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "recurring_fee" DECIMAL(10,2);

-- CreateIndex
CREATE UNIQUE INDEX "membership_charges_player_membership_id_type_billingMonth_b_key" ON "membership_charges"("player_membership_id", "type", "billingMonth", "billingYear", "billing_cycle");

-- CreateIndex
CREATE UNIQUE INDEX "student_charges_student_membership_id_type_billingMonth_bil_key" ON "student_charges"("student_membership_id", "type", "billingMonth", "billingYear", "billing_cycle");
