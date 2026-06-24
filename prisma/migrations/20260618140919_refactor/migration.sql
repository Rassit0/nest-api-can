/*
  Warnings:

  - You are about to drop the column `debtToleranceMonths` on the `team_membership_offerings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "team_membership_offerings" DROP COLUMN "debtToleranceMonths",
ADD COLUMN     "debt_tolerance_months" INTEGER NOT NULL DEFAULT 2;
