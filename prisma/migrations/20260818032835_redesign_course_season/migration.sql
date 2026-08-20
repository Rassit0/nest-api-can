/*
  Warnings:
  - You are about to drop the column `course_season_id` on the `course_season_staff` table. All the data in the column will be lost.
  - You are about to drop the column `max_members` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `min_members` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `shift_id` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `category_id` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `min_birth_year` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `max_birth_year` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `validate_age` on the `course_seasons` table. All the data in the column will be lost.
  - The primary key for the `session_courses` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `course_season_id` on the `session_courses` table. All the data in the column will be lost.
*/

-- =================================================================================
-- PHASE 1: Add new relations with NULL allowed temporarily
-- =================================================================================
-- Drop old ForeignKey constraints to avoid conflicts
ALTER TABLE "course_season_staff" DROP CONSTRAINT "course_season_staff_course_season_id_fkey";
ALTER TABLE "course_seasons" DROP CONSTRAINT "course_seasons_shift_id_fkey";
ALTER TABLE "course_seasons" DROP CONSTRAINT "course_seasons_category_id_fkey";
ALTER TABLE "session_courses" DROP CONSTRAINT "session_courses_course_season_id_fkey";
ALTER TABLE "student_memberships" DROP CONSTRAINT "student_memberships_course_season_id_fkey";
ALTER TABLE "cycle_enrollments" DROP CONSTRAINT "cycle_enrollments_course_season_id_fkey";

-- Drop old Indexes
DROP INDEX "course_seasons_course_id_category_id_season_id_gender_shift_key";
DROP INDEX IF EXISTS "course_seasons_course_id_category_id_season_id_gender_name_key";

-- Add columns without NOT NULL constraints yet
ALTER TABLE "course_season_pauses" ADD COLUMN "course_season_shift_id" TEXT;
ALTER TABLE "course_season_staff" ADD COLUMN "course_season_shift_id" TEXT;
ALTER TABLE "cycle_enrollments" ADD COLUMN "course_season_shift_id" TEXT;
ALTER TABLE "general_events" ADD COLUMN "course_season_shift_id" TEXT;
ALTER TABLE "session_courses" ADD COLUMN "course_season_shift_id" TEXT;
ALTER TABLE "student_memberships" ADD COLUMN "course_season_shift_id" TEXT;
ALTER TABLE "course_seasons" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Regular';
ALTER TABLE "course_seasons" ADD COLUMN "categoryId" TEXT;

-- Create the new shift config table
CREATE TABLE "course_season_shifts" (
    "id" TEXT NOT NULL,
    "course_season_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "max_members" INTEGER NOT NULL,
    "min_members" INTEGER NOT NULL,
    "category_id" TEXT NOT NULL,
    "gender" "ProgramGender" NOT NULL,
    "min_birth_year" INTEGER,
    "max_birth_year" INTEGER,
    "validate_age" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "course_season_shifts_pkey" PRIMARY KEY ("id")
);

-- =================================================================================
-- PHASE 2: Data Backfill
-- =================================================================================
-- Ensure uuid extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2.1 Backfill course_season_shifts from existing course_seasons
INSERT INTO "course_season_shifts" (
  "id", "course_season_id", "shift_id", "category_id", "gender", 
  "min_birth_year", "max_birth_year", "validate_age", 
  "max_members", "min_members", "updated_at"
)
SELECT 
  uuid_generate_v4(), id, shift_id, category_id, gender, 
  min_birth_year, max_birth_year, validate_age, 
  max_members, min_members, CURRENT_TIMESTAMP
FROM "course_seasons";

-- 2.2 Reassign foreign keys for historical data
-- Since the old model had a strict 1:1 mapping between course_season and shift,
-- we can safely map them based purely on course_season_id matching.
UPDATE "student_memberships" sm
SET "course_season_shift_id" = css."id"
FROM "course_season_shifts" css
WHERE css."course_season_id" = sm."course_season_id";

UPDATE "cycle_enrollments" ce
SET "course_season_shift_id" = css."id"
FROM "course_season_shifts" css
WHERE css."course_season_id" = ce."course_season_id";

UPDATE "session_courses" sc
SET "course_season_shift_id" = css."id"
FROM "course_season_shifts" css
WHERE css."course_season_id" = sc."course_season_id";

UPDATE "course_season_staff" csst
SET "course_season_shift_id" = css."id"
FROM "course_season_shifts" css
WHERE css."course_season_id" = csst."course_season_id";

UPDATE "course_season_pauses" csp
SET "course_season_shift_id" = css."id"
FROM "course_season_shifts" css
WHERE css."course_season_id" = csp."course_season_id";

UPDATE "general_events" ge
SET "course_season_shift_id" = css."id"
FROM "course_season_shifts" css
WHERE css."course_season_id" = ge."course_season_id";

-- 2.3 Set the backwards compatible field
UPDATE "course_seasons" SET "categoryId" = "category_id";

-- =================================================================================
-- PHASE 3: Validations
-- =================================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM "student_memberships" WHERE "course_season_shift_id" IS NULL) THEN
    RAISE EXCEPTION 'Backfill failed: Some student_memberships have NULL course_season_shift_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "cycle_enrollments" WHERE "course_season_shift_id" IS NULL) THEN
    RAISE EXCEPTION 'Backfill failed: Some cycle_enrollments have NULL course_season_shift_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "session_courses" WHERE "course_season_shift_id" IS NULL) THEN
    RAISE EXCEPTION 'Backfill failed: Some session_courses have NULL course_season_shift_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "course_season_staff" WHERE "course_season_shift_id" IS NULL) THEN
    RAISE EXCEPTION 'Backfill failed: Some course_season_staff have NULL course_season_shift_id';
  END IF;
END $$;

-- =================================================================================
-- PHASE 4: Enforce Constraints & Drop Legacy Columns
-- =================================================================================
ALTER TABLE "student_memberships" ALTER COLUMN "course_season_shift_id" SET NOT NULL;
ALTER TABLE "cycle_enrollments" ALTER COLUMN "course_season_shift_id" SET NOT NULL;
ALTER TABLE "course_season_staff" ALTER COLUMN "course_season_shift_id" SET NOT NULL;
ALTER TABLE "session_courses" ALTER COLUMN "course_season_shift_id" SET NOT NULL;

-- Remove old compound PK for session_courses and set new one
ALTER TABLE "session_courses" DROP CONSTRAINT "session_courses_pkey";
ALTER TABLE "session_courses" DROP COLUMN "course_season_id";
ALTER TABLE "session_courses" ADD CONSTRAINT "session_courses_pkey" PRIMARY KEY ("sessionId", "course_season_shift_id");

-- Remove old course_season_id from tables where it's replaced completely
ALTER TABLE "course_season_staff" DROP COLUMN "course_season_id";

-- Drop legacy configuration columns from course_seasons
ALTER TABLE "course_seasons" DROP COLUMN "category_id",
DROP COLUMN "gender",
DROP COLUMN "min_birth_year",
DROP COLUMN "max_birth_year",
DROP COLUMN "validate_age",
DROP COLUMN "max_members",
DROP COLUMN "min_members",
DROP COLUMN "shift_id";

-- =================================================================================
-- PHASE 5: Restore Indexes & Foreign Keys
-- =================================================================================
CREATE UNIQUE INDEX "course_season_shifts_id_course_season_id_key" ON "course_season_shifts"("id", "course_season_id");
CREATE UNIQUE INDEX "course_season_shifts_course_season_id_shift_id_key" ON "course_season_shifts"("course_season_id", "shift_id");
CREATE UNIQUE INDEX "course_seasons_course_id_season_id_name_key" ON "course_seasons"("course_id", "season_id", "name");

ALTER TABLE "course_seasons" ADD CONSTRAINT "course_seasons_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Constraints for shifts
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rebuild remaining references
ALTER TABLE "course_season_pauses" ADD CONSTRAINT "course_season_pauses_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_season_staff" ADD CONSTRAINT "course_season_staff_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "general_events" ADD CONSTRAINT "general_events_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_courses" ADD CONSTRAINT "session_courses_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- COMPOSITE FOREIGN KEYS for membership and enrollments
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_course_season_shift_id_course_season_i_fkey" FOREIGN KEY ("course_season_shift_id", "course_season_id") REFERENCES "course_season_shifts"("id", "course_season_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_course_season_shift_id_course_season_id_fkey" FOREIGN KEY ("course_season_shift_id", "course_season_id") REFERENCES "course_season_shifts"("id", "course_season_id") ON DELETE RESTRICT ON UPDATE CASCADE;
