-- AlterTable
ALTER TABLE "progress_evaluations" ADD COLUMN     "course_season_shift_id" TEXT,
ADD COLUMN     "team_season_category_id" TEXT;

-- CreateIndex
CREATE INDEX "progress_evaluations_course_season_shift_id_student_id_eval_idx" ON "progress_evaluations"("course_season_shift_id", "student_id", "evaluation_date" DESC);

-- CreateIndex
CREATE INDEX "progress_evaluations_team_season_category_id_player_id_eval_idx" ON "progress_evaluations"("team_season_category_id", "player_id", "evaluation_date" DESC);

-- AddForeignKey
ALTER TABLE "progress_evaluations" ADD CONSTRAINT "progress_evaluations_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_evaluations" ADD CONSTRAINT "progress_evaluations_team_season_category_id_fkey" FOREIGN KEY ("team_season_category_id") REFERENCES "team_season_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint
ALTER TABLE "progress_evaluations" ADD CONSTRAINT "progress_evaluations_group_and_participant_check"
CHECK (
  (
    "course_season_shift_id" IS NOT NULL
    AND "team_season_category_id" IS NULL
    AND "student_id" IS NOT NULL
    AND "player_id" IS NULL
  )
  OR
  (
    "course_season_shift_id" IS NULL
    AND "team_season_category_id" IS NOT NULL
    AND "student_id" IS NULL
    AND "player_id" IS NOT NULL
  )
);
