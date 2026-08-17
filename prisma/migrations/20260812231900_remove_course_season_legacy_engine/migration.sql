/*
  Warnings:
  - You are about to drop the column `charge_generation_days_before` on the `course_season_billing_configs` table. All the data in the column will be lost.
  - You are about to drop the column `is_engine_active` on the `course_season_billing_configs` table. All the data in the column will be lost.
  - You are about to drop the column `nextRecurringChargeGenerationDate` on the `student_memberships` table. All the data in the column will be lost.
*/
-- AlterTable
ALTER TABLE "course_season_billing_configs" DROP COLUMN "charge_generation_days_before",
DROP COLUMN "is_engine_active";

-- AlterTable
ALTER TABLE "student_memberships" DROP COLUMN "nextRecurringChargeGenerationDate";
