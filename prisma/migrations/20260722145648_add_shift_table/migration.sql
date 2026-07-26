/*
  Warnings:

  - A unique constraint covering the columns `[course_id,category_id,season_id,gender,shift_id]` on the table `course_seasons` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `shift_id` to the `course_seasons` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "course_seasons_course_id_category_id_season_id_gender_key";

-- AlterTable
ALTER TABLE "course_seasons" ADD COLUMN     "shift_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shifts_institution_id_name_key" ON "shifts"("institution_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "course_seasons_course_id_category_id_season_id_gender_shift_key" ON "course_seasons"("course_id", "category_id", "season_id", "gender", "shift_id");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_seasons" ADD CONSTRAINT "course_seasons_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
