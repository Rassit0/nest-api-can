/*
  Warnings:

  - You are about to drop the column `suspensionAfterMonthsDue` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `suspensionAfterMonthsDue` on the `team_seasons` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "course_seasons" DROP COLUMN "suspensionAfterMonthsDue",
ADD COLUMN     "status_notes" TEXT,
ADD COLUMN     "suspension_after_months_due" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "team_seasons" DROP COLUMN "suspensionAfterMonthsDue",
ADD COLUMN     "status_notes" TEXT,
ADD COLUMN     "suspension_after_months_due" INTEGER NOT NULL DEFAULT 2;
