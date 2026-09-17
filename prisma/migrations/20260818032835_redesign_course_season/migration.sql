/*
  Warnings:

  - You are about to drop the column `course_season_id` on the `course_season_staff` table. All the data in the column will be lost.
  - You are about to drop the column `max_members` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `min_members` on the `course_seasons` table. All the data in the column will be lost.
  - You are about to drop the column `shift_id` on the `course_seasons` table. All the data in the column will be lost.
  - The primary key for the `session_courses` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `course_season_id` on the `session_courses` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[course_id,category_id,season_id,gender,name]` on the table `course_seasons` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `course_season_shift_id` to the `course_season_staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `course_season_shift_id` to the `cycle_enrollments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `course_season_shift_id` to the `session_courses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `course_season_shift_id` to the `student_memberships` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "course_season_staff" DROP CONSTRAINT "course_season_staff_course_season_id_fkey";

-- DropForeignKey
ALTER TABLE "course_seasons" DROP CONSTRAINT "course_seasons_shift_id_fkey";

-- DropForeignKey
ALTER TABLE "session_courses" DROP CONSTRAINT "session_courses_course_season_id_fkey";

-- DropIndex
DROP INDEX "course_seasons_course_id_category_id_season_id_gender_shift_key";

-- AlterTable
ALTER TABLE "course_season_pauses" ADD COLUMN     "course_season_shift_id" TEXT;

-- AlterTable
ALTER TABLE "course_season_staff" DROP COLUMN "course_season_id",
ADD COLUMN     "course_season_shift_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "course_seasons" DROP COLUMN "max_members",
DROP COLUMN "min_members",
DROP COLUMN "shift_id",
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Regular';

-- AlterTable
ALTER TABLE "cycle_enrollments" ADD COLUMN     "course_season_shift_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "general_events" ADD COLUMN     "course_season_shift_id" TEXT;

-- AlterTable
ALTER TABLE "session_courses" DROP CONSTRAINT "session_courses_pkey",
DROP COLUMN "course_season_id",
ADD COLUMN     "course_season_shift_id" TEXT NOT NULL,
ADD CONSTRAINT "session_courses_pkey" PRIMARY KEY ("sessionId", "course_season_shift_id");

-- AlterTable
ALTER TABLE "student_memberships" ADD COLUMN     "course_season_shift_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "course_season_shifts" (
    "id" TEXT NOT NULL,
    "course_season_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "max_members" INTEGER NOT NULL,
    "min_members" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "course_season_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_season_shifts_course_season_id_shift_id_key" ON "course_season_shifts"("course_season_id", "shift_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_seasons_course_id_category_id_season_id_gender_name_key" ON "course_seasons"("course_id", "category_id", "season_id", "gender", "name");

-- AddForeignKey
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_pauses" ADD CONSTRAINT "course_season_pauses_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_staff" ADD CONSTRAINT "course_season_staff_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "general_events" ADD CONSTRAINT "general_events_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_courses" ADD CONSTRAINT "session_courses_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
