-- AlterTable
ALTER TABLE "payment_plans" ADD COLUMN     "advance_cycles" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "free_initial_cycles" INTEGER NOT NULL DEFAULT 0;
