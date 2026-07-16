-- AlterTable
ALTER TABLE "course_seasons" ADD COLUMN     "is_registration_open" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "team_seasons" ADD COLUMN     "is_registration_open" BOOLEAN NOT NULL DEFAULT true;
