/*
  Warnings:

  - Added the required column `previous_team_source` to the `player_passes` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PreviousTeamSource" AS ENUM ('SYSTEM', 'EXTERNAL', 'FREE_AGENT');

-- AlterTable
ALTER TABLE "player_passes" ADD COLUMN     "previous_team_source" "PreviousTeamSource" NOT NULL;
