-- AlterTable
ALTER TABLE "course_seasons" ALTER COLUMN "registration_fee" DROP NOT NULL,
ALTER COLUMN "monthly_fee" DROP NOT NULL;

-- AlterTable
ALTER TABLE "team_seasons" ALTER COLUMN "monthly_fee" DROP NOT NULL,
ALTER COLUMN "registration_fee" DROP NOT NULL;
