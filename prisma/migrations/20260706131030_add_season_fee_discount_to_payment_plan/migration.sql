-- AlterTable
ALTER TABLE "payment_plans" ADD COLUMN     "season_fee_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ALTER COLUMN "registration_discount_percent" SET DEFAULT 0,
ALTER COLUMN "monthly_discount_percent" SET DEFAULT 0;
