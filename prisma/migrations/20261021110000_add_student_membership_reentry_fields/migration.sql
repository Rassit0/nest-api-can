-- AlterTable
ALTER TABLE "student_memberships" 
ADD COLUMN IF NOT EXISTS "reentered_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "student_membership_histories" 
ADD COLUMN IF NOT EXISTS "effective_date" TIMESTAMP(3);

-- CreateIndex: Índice único parcial para garantizar un único registro vigente (ACTIVE, PENDING_ACTIVE, SUSPENDED) por estudiante y CourseSeason
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_student_membership" 
ON "student_memberships"("student_id", "course_season_id") 
WHERE "status" IN ('ACTIVE', 'PENDING_ACTIVE', 'SUSPENDED');
