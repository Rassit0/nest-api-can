-- DropForeignKey
ALTER TABLE "course_seasons" DROP CONSTRAINT "course_seasons_category_id_fkey";

-- AlterTable
ALTER TABLE "course_seasons" DROP COLUMN "category_id";
