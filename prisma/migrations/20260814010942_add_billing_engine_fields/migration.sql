-- AlterTable
ALTER TABLE "course_season_billing_configs" ADD COLUMN     "charge_generation_days_before" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "is_engine_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "student_memberships" ADD COLUMN     "nextRecurringChargeGenerationDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "student_memberships_nextRecurringChargeGenerationDate_idx" ON "student_memberships"("nextRecurringChargeGenerationDate");
