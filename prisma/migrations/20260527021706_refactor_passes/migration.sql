/*
  Warnings:

  - You are about to drop the column `player_id` on the `player_passes` table. All the data in the column will be lost.
  - You are about to drop the column `player_pass_offering_id` on the `player_passes` table. All the data in the column will be lost.
  - You are about to drop the column `team_id` on the `player_passes` table. All the data in the column will be lost.
  - You are about to drop the `player_pass_offerings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `player_reinforcements` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `current_team_id` to the `player_passes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `origin_type` to the `player_passes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pass_type` to the `player_passes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `playerId` to the `player_passes` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PlayerPassType" AS ENUM ('PERMANENT', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "PassOriginType" AS ENUM ('INTERNAL', 'EXTERNAL', 'FREE_AGENT');

-- DropForeignKey
ALTER TABLE "player_pass_offerings" DROP CONSTRAINT "player_pass_offerings_team_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "player_passes" DROP CONSTRAINT "player_passes_player_id_fkey";

-- DropForeignKey
ALTER TABLE "player_passes" DROP CONSTRAINT "player_passes_player_pass_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "player_passes" DROP CONSTRAINT "player_passes_team_id_fkey";

-- DropForeignKey
ALTER TABLE "player_reinforcements" DROP CONSTRAINT "player_reinforcements_player_id_fkey";

-- DropForeignKey
ALTER TABLE "player_reinforcements" DROP CONSTRAINT "player_reinforcements_team_offering_id_fkey";

-- AlterTable
ALTER TABLE "player_passes" DROP COLUMN "player_id",
DROP COLUMN "player_pass_offering_id",
DROP COLUMN "team_id",
ADD COLUMN     "current_team_id" TEXT NOT NULL,
ADD COLUMN     "external_previous_team_name" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "origin_type" "PassOriginType" NOT NULL,
ADD COLUMN     "pass_type" "PlayerPassType" NOT NULL,
ADD COLUMN     "playerId" TEXT NOT NULL,
ADD COLUMN     "previous_team_id" TEXT;

-- DropTable
DROP TABLE "player_pass_offerings";

-- DropTable
DROP TABLE "player_reinforcements";

-- DropEnum
DROP TYPE "PassType";

-- AddForeignKey
ALTER TABLE "player_passes" ADD CONSTRAINT "player_passes_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_passes" ADD CONSTRAINT "player_passes_current_team_id_fkey" FOREIGN KEY ("current_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_passes" ADD CONSTRAINT "player_passes_previous_team_id_fkey" FOREIGN KEY ("previous_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
