-- AlterTable
ALTER TABLE "course_seasons" ADD COLUMN     "validate_age" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "team_seasons" ADD COLUMN     "validate_age" BOOLEAN NOT NULL DEFAULT true;
