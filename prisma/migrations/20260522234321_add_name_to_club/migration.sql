/*
  Warnings:

  - Added the required column `name` to the `clubs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('TRAINING', 'MATCH', 'CLASS', 'EVENT', 'RENTAL');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "type" "ActivityType" NOT NULL DEFAULT 'TRAINING';

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "name" TEXT NOT NULL;
