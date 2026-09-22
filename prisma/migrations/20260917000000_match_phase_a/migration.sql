-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "away_coach_id" TEXT,
ADD COLUMN     "away_coach_name" TEXT,
ADD COLUMN     "competition_name" TEXT,
ADD COLUMN     "home_coach_id" TEXT,
ADD COLUMN     "home_coach_name" TEXT;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_coach_id_fkey" FOREIGN KEY ("home_coach_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_coach_id_fkey" FOREIGN KEY ("away_coach_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

