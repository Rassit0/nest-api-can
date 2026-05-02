/*
  Warnings:

  - Made the column `minAge` on table `activity_categories` required. This step will fail if there are existing NULL values in that column.
  - Made the column `maxAge` on table `activity_categories` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "activity_categories" ALTER COLUMN "minAge" SET NOT NULL,
ALTER COLUMN "maxAge" SET NOT NULL;
