-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_team_season_category_id_fkey";

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "away_team_season_category_id" TEXT,
ADD COLUMN     "home_team_season_category_id" TEXT,
ALTER COLUMN "team_season_category_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_season_category_id_fkey" FOREIGN KEY ("team_season_category_id") REFERENCES "team_season_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_season_category_id_fkey" FOREIGN KEY ("home_team_season_category_id") REFERENCES "team_season_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_season_category_id_fkey" FOREIGN KEY ("away_team_season_category_id") REFERENCES "team_season_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Deterministic Backfill
UPDATE "matches"
SET "home_team_season_category_id" = "team_season_category_id"
FROM "team_season_categories" tsc
JOIN "team_seasons" ts ON tsc."team_season_id" = ts."id"
WHERE "matches"."team_season_category_id" = tsc."id"
  AND ts."team_id" = "matches"."home_team_id"
  AND ts."team_id" != "matches"."away_team_id";

UPDATE "matches"
SET "away_team_season_category_id" = "team_season_category_id"
FROM "team_season_categories" tsc
JOIN "team_seasons" ts ON tsc."team_season_id" = ts."id"
WHERE "matches"."team_season_category_id" = tsc."id"
  AND ts."team_id" = "matches"."away_team_id"
  AND ts."team_id" != "matches"."home_team_id";
