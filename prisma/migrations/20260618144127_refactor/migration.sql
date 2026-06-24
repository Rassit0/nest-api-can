/*
  Warnings:

  - You are about to drop the column `team_membership_offering_id` on the `payment_plans` table. All the data in the column will be lost.
  - You are about to drop the column `team_membership_offering_id` on the `player_membership` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `team_seasons` table. All the data in the column will be lost.
  - You are about to drop the `team_membership_offerings` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `team_season_id` to the `payment_plans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `team_season_id` to the `player_membership` table without a default value. This is not possible if the table is not empty.
  - Added the required column `billing_day` to the `team_seasons` table without a default value. This is not possible if the table is not empty.
  - Added the required column `monthly_fee` to the `team_seasons` table without a default value. This is not possible if the table is not empty.
  - Added the required column `registration_fee` to the `team_seasons` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StatusTeamSeason" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "payment_plans" DROP CONSTRAINT "payment_plans_team_membership_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "player_membership" DROP CONSTRAINT "player_membership_team_membership_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "team_membership_offerings" DROP CONSTRAINT "team_membership_offerings_team_season_id_fkey";

-- AlterTable
ALTER TABLE "payment_plans" DROP COLUMN "team_membership_offering_id",
ADD COLUMN     "team_season_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "player_membership" DROP COLUMN "team_membership_offering_id",
ADD COLUMN     "team_season_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "team_seasons" DROP COLUMN "is_active",
ADD COLUMN     "billing_day" INTEGER NOT NULL,
ADD COLUMN     "debt_tolerance_months" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "grace_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "late_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "late_fee_per_day" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "monthly_fee" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "registration_fee" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "status" "StatusTeamSeason" NOT NULL DEFAULT 'DRAFT';

-- DropTable
DROP TABLE "team_membership_offerings";

-- DropEnum
DROP TYPE "StatusOffering";

-- AddForeignKey
ALTER TABLE "player_membership" ADD CONSTRAINT "player_membership_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
