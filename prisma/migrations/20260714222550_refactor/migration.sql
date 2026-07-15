/*
  Warnings:

  - You are about to drop the column `billing_day` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `billing_frequency` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `billing_type` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `charge_generation_days_before` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `debt_tolerance_months` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `grace_days` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `late_fee_enabled` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `late_fee_per_day` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `prorate_first_recurring_fee` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `prorate_last_recurring_fee` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `prorate_registration_fee` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `prorate_season_fee` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `recurring_fee` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `registration_fee` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `season_fee` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `billing_day` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `billing_frequency` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `billing_type` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `charge_generation_days_before` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `debt_tolerance_months` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `grace_days` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `late_fee_enabled` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `late_fee_per_day` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `prorate_first_recurring_fee` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `prorate_last_recurring_fee` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `prorate_registration_fee` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `prorate_season_fee` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `recurring_fee` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `registration_fee` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `season_fee` on the `team_seasons` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "course_seasons" DROP COLUMN "billing_day",
DROP COLUMN "billing_frequency",
DROP COLUMN "billing_type",
DROP COLUMN "charge_generation_days_before",
DROP COLUMN "debt_tolerance_months",
DROP COLUMN "grace_days",
DROP COLUMN "late_fee_enabled",
DROP COLUMN "late_fee_per_day",
DROP COLUMN "prorate_first_recurring_fee",
DROP COLUMN "prorate_last_recurring_fee",
DROP COLUMN "prorate_registration_fee",
DROP COLUMN "prorate_season_fee",
DROP COLUMN "recurring_fee",
DROP COLUMN "registration_fee",
DROP COLUMN "season_fee";

-- AlterTable
ALTER TABLE "membership_discounts" ADD COLUMN     "season_fee_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "student_discounts" ADD COLUMN     "season_fee_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "team_seasons" DROP COLUMN "billing_day",
DROP COLUMN "billing_frequency",
DROP COLUMN "billing_type",
DROP COLUMN "charge_generation_days_before",
DROP COLUMN "debt_tolerance_months",
DROP COLUMN "grace_days",
DROP COLUMN "late_fee_enabled",
DROP COLUMN "late_fee_per_day",
DROP COLUMN "prorate_first_recurring_fee",
DROP COLUMN "prorate_last_recurring_fee",
DROP COLUMN "prorate_registration_fee",
DROP COLUMN "prorate_season_fee",
DROP COLUMN "recurring_fee",
DROP COLUMN "registration_fee",
DROP COLUMN "season_fee";

-- CreateTable
CREATE TABLE "team_season_billing_configs" (
    "id" TEXT NOT NULL,
    "team_season_id" TEXT NOT NULL,
    "is_engine_active" BOOLEAN NOT NULL DEFAULT true,
    "billing_day" INTEGER NOT NULL,
    "registration_fee" DECIMAL(10,2),
    "recurring_fee" DECIMAL(10,2),
    "season_fee" DECIMAL(10,2),
    "debt_tolerance_months" INTEGER NOT NULL DEFAULT 2,
    "late_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
    "late_fee_per_day" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "billing_type" "SeasonBillingType" NOT NULL DEFAULT 'MONTHLY_ONLY',
    "billing_frequency" "BillingFrequency" NOT NULL DEFAULT 'MONTHLY',
    "prorate_first_recurring_fee" BOOLEAN NOT NULL DEFAULT true,
    "prorate_last_recurring_fee" BOOLEAN NOT NULL DEFAULT true,
    "prorate_registration_fee" BOOLEAN NOT NULL DEFAULT false,
    "prorate_season_fee" BOOLEAN NOT NULL DEFAULT false,
    "charge_generation_days_before" INTEGER NOT NULL DEFAULT 7,

    CONSTRAINT "team_season_billing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_membership_pauses" (
    "id" TEXT NOT NULL,
    "player_membership_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_membership_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_season_pauses" (
    "id" TEXT NOT NULL,
    "team_season_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_season_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_season_pauses" (
    "id" TEXT NOT NULL,
    "course_season_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_season_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_season_billing_configs" (
    "id" TEXT NOT NULL,
    "course_season_id" TEXT NOT NULL,
    "is_engine_active" BOOLEAN NOT NULL DEFAULT true,
    "billing_day" INTEGER NOT NULL,
    "registration_fee" DECIMAL(10,2),
    "recurring_fee" DECIMAL(10,2),
    "season_fee" DECIMAL(10,2),
    "debt_tolerance_months" INTEGER NOT NULL DEFAULT 2,
    "late_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
    "late_fee_per_day" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "charge_generation_days_before" INTEGER NOT NULL DEFAULT 7,
    "billing_type" "SeasonBillingType" NOT NULL DEFAULT 'MONTHLY_ONLY',
    "billing_frequency" "BillingFrequency" NOT NULL DEFAULT 'MONTHLY',
    "prorate_first_recurring_fee" BOOLEAN NOT NULL DEFAULT true,
    "prorate_last_recurring_fee" BOOLEAN NOT NULL DEFAULT true,
    "prorate_registration_fee" BOOLEAN NOT NULL DEFAULT false,
    "prorate_season_fee" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "course_season_billing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_membership_pauses" (
    "id" TEXT NOT NULL,
    "student_membership_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_membership_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_season_billing_configs_team_season_id_key" ON "team_season_billing_configs"("team_season_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_season_billing_configs_course_season_id_key" ON "course_season_billing_configs"("course_season_id");

-- AddForeignKey
ALTER TABLE "team_season_billing_configs" ADD CONSTRAINT "team_season_billing_configs_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership_pauses" ADD CONSTRAINT "player_membership_pauses_player_membership_id_fkey" FOREIGN KEY ("player_membership_id") REFERENCES "player_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_pauses" ADD CONSTRAINT "team_season_pauses_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_pauses" ADD CONSTRAINT "course_season_pauses_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_billing_configs" ADD CONSTRAINT "course_season_billing_configs_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_membership_pauses" ADD CONSTRAINT "student_membership_pauses_student_membership_id_fkey" FOREIGN KEY ("student_membership_id") REFERENCES "student_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
