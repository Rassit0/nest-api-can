-- CreateEnum
CREATE TYPE "SeasonBillingType" AS ENUM ('MONTHLY_ONLY', 'SINGLE_ONLY', 'BOTH');

-- AlterTable
ALTER TABLE "course_seasons" ADD COLUMN     "billing_type" "SeasonBillingType" NOT NULL DEFAULT 'MONTHLY_ONLY',
ADD COLUMN     "season_fee" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "payment_plans" ADD COLUMN     "is_single_payment" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "team_seasons" ADD COLUMN     "billing_type" "SeasonBillingType" NOT NULL DEFAULT 'MONTHLY_ONLY',
ADD COLUMN     "season_fee" DECIMAL(10,2);
