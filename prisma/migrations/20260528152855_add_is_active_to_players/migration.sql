/*
  Warnings:

  - You are about to drop the column `isActive` on the `persons` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "persons" DROP COLUMN "isActive",
ALTER COLUMN "birth_date" DROP NOT NULL;

-- AlterTable
ALTER TABLE "player_passes" ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
