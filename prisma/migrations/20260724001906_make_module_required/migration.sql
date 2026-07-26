/*
  Warnings:

  - Made the column `module_id` on table `permissions` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "module_id" SET NOT NULL;
