-- CreateEnum
CREATE TYPE "TeamSeasonCategoryStatus" AS ENUM ('ACTIVE', 'FINISHED');

-- AlterTable
ALTER TABLE "team_season_categories" ADD COLUMN     "ended_at" TIMESTAMP(3),
ADD COLUMN     "status" "TeamSeasonCategoryStatus" NOT NULL DEFAULT 'ACTIVE';
