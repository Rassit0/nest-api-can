/*
  Warnings:

  - You are about to drop the column `opponent_name` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `our_score` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `teamSeasonCategoryId` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `their_score` on the `matches` table. All the data in the column will be lost.
  - Added the required column `away_team_id` to the `matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `home_team_id` to the `matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `team_season_category_id` to the `matches` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_teamSeasonCategoryId_fkey";

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "is_external" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "matches" DROP COLUMN "opponent_name",
DROP COLUMN "our_score",
DROP COLUMN "teamSeasonCategoryId",
DROP COLUMN "their_score",
ADD COLUMN     "away_score" INTEGER,
ADD COLUMN     "away_team_id" TEXT NOT NULL,
ADD COLUMN     "home_score" INTEGER,
ADD COLUMN     "home_team_id" TEXT NOT NULL,
ADD COLUMN     "team_season_category_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_season_category_id_fkey" FOREIGN KEY ("team_season_category_id") REFERENCES "team_season_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
