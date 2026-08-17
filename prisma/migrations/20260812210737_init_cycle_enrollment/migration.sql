-- CreateEnum
CREATE TYPE "CycleEnrollmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "course_season_billing_configs" ADD COLUMN     "proration_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "cycle_enrollments" (
    "id" TEXT NOT NULL,
    "student_membership_id" TEXT NOT NULL,
    "charge_id" TEXT,
    "cycle_start_date" TIMESTAMP(3) NOT NULL,
    "cycle_end_date" TIMESTAMP(3) NOT NULL,
    "effective_start_date" TIMESTAMP(3) NOT NULL,
    "status" "CycleEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "cycle_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cycle_enrollments_charge_id_key" ON "cycle_enrollments"("charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_enrollments_student_membership_id_cycle_start_date_cy_key" ON "cycle_enrollments"("student_membership_id", "cycle_start_date", "cycle_end_date");

-- AddForeignKey
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_student_membership_id_fkey" FOREIGN KEY ("student_membership_id") REFERENCES "student_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
