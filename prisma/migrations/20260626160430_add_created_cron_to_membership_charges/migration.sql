-- AlterTable
ALTER TABLE "membership_charges" ADD COLUMN     "created_by_cron" BOOLEAN NOT NULL DEFAULT false;
