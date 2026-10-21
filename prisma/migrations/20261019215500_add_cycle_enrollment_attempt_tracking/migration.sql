-- DropIndex
DROP INDEX IF EXISTS "cycle_enrollments_student_membership_id_cycle_start_date_cy_key";

-- DropIndex
DROP INDEX IF EXISTS "student_charges_student_membership_id_type_billingMonth_bil_key";

-- AlterTable
ALTER TABLE "cycle_enrollments" 
ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "cancellation_reason" TEXT,
ADD COLUMN "cancelled_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "student_charges" 
ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex: Clave única por intento histórico
CREATE UNIQUE INDEX "cycle_enrollments_student_membership_id_cycle_start_date_cy_key" 
ON "cycle_enrollments"("student_membership_id", "cycle_start_date", "cycle_end_date", "attempt");

-- CreateIndex: Índice único parcial para garantizar un único intento vigente (PENDING o CONFIRMED)
CREATE UNIQUE INDEX "unique_active_cycle_enrollment" 
ON "cycle_enrollments"("student_membership_id", "cycle_start_date", "cycle_end_date") 
WHERE "status" IN ('PENDING', 'CONFIRMED');

-- CreateIndex: Clave única por intento de StudentCharge con NULLS NOT DISTINCT para soportar billing_cycle NULL
CREATE UNIQUE INDEX "student_charges_student_membership_id_type_billingMonth_bil_key" 
ON "student_charges"("student_membership_id", "type", "billingMonth", "billingYear", "billing_cycle", "attempt") 
NULLS NOT DISTINCT;
