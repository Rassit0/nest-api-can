-- AlterTable
ALTER TABLE "course_seasons" ADD COLUMN     "prorate_first_recurring_fee" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prorate_last_recurring_fee" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prorate_registration_fee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prorate_season_fee" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "team_seasons" ADD COLUMN     "prorate_first_recurring_fee" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prorate_last_recurring_fee" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prorate_registration_fee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prorate_season_fee" BOOLEAN NOT NULL DEFAULT false;
