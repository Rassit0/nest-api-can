/*
  Warnings:

  - The values [MONTHLY_FEE] on the enum `TypeMembershipCharge` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `monthly_discount_percent` on the `membership_discounts` table. All the data in the column will be lost.
  - You are about to drop the column `monthly_discount_percent` on the `payment_plans` table. All the data in the column will be lost.
  - You are about to drop the column `nextMonthlyChargeGenerationDate` on the `player_membership` table. All the data in the column will be lost.
  - You are about to drop the column `monthly_discount_percent` on the `student_discounts` table. All the data in the column will be lost.
  - You are about to drop the column `nextMonthlyChargeGenerationDate` on the `student_memberships` table. All the data in the column will be lost.
  - Added the required column `recurring_discount_percent` to the `membership_discounts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recurring_discount_percent` to the `student_discounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "BillingFrequency" ADD VALUE 'SINGLE';

-- AlterEnum
BEGIN;
CREATE TYPE "TypeMembershipCharge_new" AS ENUM ('REGISTRATION', 'RECURRING_FEE', 'SEASON_FEE', 'LATE_FEE', 'MANUAL');
ALTER TABLE "membership_charges" ALTER COLUMN "type" TYPE "TypeMembershipCharge_new" USING ("type"::text::"TypeMembershipCharge_new");
ALTER TABLE "student_charges" ALTER COLUMN "type" TYPE "TypeMembershipCharge_new" USING ("type"::text::"TypeMembershipCharge_new");
ALTER TYPE "TypeMembershipCharge" RENAME TO "TypeMembershipCharge_old";
ALTER TYPE "TypeMembershipCharge_new" RENAME TO "TypeMembershipCharge";
DROP TYPE "public"."TypeMembershipCharge_old";
COMMIT;

-- DropIndex
DROP INDEX "player_membership_nextMonthlyChargeGenerationDate_idx";

-- DropIndex
DROP INDEX "student_memberships_nextMonthlyChargeGenerationDate_idx";

-- AlterTable
ALTER TABLE "membership_discounts" DROP COLUMN "monthly_discount_percent",
ADD COLUMN     "recurring_discount_percent" DECIMAL(5,2) NOT NULL;

-- AlterTable
ALTER TABLE "payment_plans" DROP COLUMN "monthly_discount_percent",
ADD COLUMN     "recurring_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "player_membership" DROP COLUMN "nextMonthlyChargeGenerationDate",
ADD COLUMN     "nextRecurringChargeGenerationDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "student_discounts" DROP COLUMN "monthly_discount_percent",
ADD COLUMN     "recurring_discount_percent" DECIMAL(5,2) NOT NULL;

-- AlterTable
ALTER TABLE "student_memberships" DROP COLUMN "nextMonthlyChargeGenerationDate",
ADD COLUMN     "nextRecurringChargeGenerationDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "player_membership_nextRecurringChargeGenerationDate_idx" ON "player_membership"("nextRecurringChargeGenerationDate");

-- CreateIndex
CREATE INDEX "student_memberships_nextRecurringChargeGenerationDate_idx" ON "student_memberships"("nextRecurringChargeGenerationDate");
