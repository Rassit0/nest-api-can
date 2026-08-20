-- DropForeignKey
ALTER TABLE "course_seasons" DROP CONSTRAINT "course_seasons_categoryId_fkey";

-- AlterTable
ALTER TABLE "course_seasons" DROP COLUMN "categoryId";
