/*
  Warnings:

  - A unique constraint covering the columns `[course_id,category_id,season_id,gender,shift_id,status]` on the table `course_seasons` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[team_id,category_id,season_id,gender,status]` on the table `team_seasons` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "course_seasons_course_id_category_id_season_id_gender_shift_key";

-- DropIndex
DROP INDEX "team_seasons_team_id_category_id_season_id_gender_key";

-- CreateIndex
CREATE UNIQUE INDEX "course_seasons_course_id_category_id_season_id_gender_shift_key" ON "course_seasons"("course_id", "category_id", "season_id", "gender", "shift_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "team_seasons_team_id_category_id_season_id_gender_status_key" ON "team_seasons"("team_id", "category_id", "season_id", "gender", "status");
