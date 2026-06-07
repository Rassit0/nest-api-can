/*
  Warnings:

  - You are about to drop the column `pass_type` on the `player_passes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "player_passes" DROP COLUMN "pass_type",
ADD COLUMN     "external_next_team_name" TEXT;

-- DropEnum
DROP TYPE "PlayerPassType";

-- CreateTable
CREATE TABLE "team_season_extensions" (
    "id" TEXT NOT NULL,
    "team_season_id" TEXT NOT NULL,
    "previous_end_date" TIMESTAMP(3) NOT NULL,
    "new_end_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_season_extensions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "team_season_extensions" ADD CONSTRAINT "team_season_extensions_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
