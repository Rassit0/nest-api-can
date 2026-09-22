-- DropForeignKey
ALTER TABLE "match_lineups" DROP CONSTRAINT "match_lineups_match_id_fkey";

-- DropForeignKey
ALTER TABLE "match_lineups" DROP CONSTRAINT "match_lineups_player_id_fkey";

-- DropIndex
DROP INDEX "match_lineups_match_id_player_id_key";

-- AlterTable
ALTER TABLE "match_call_ups" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updated_by_id" TEXT;

-- AlterTable
ALTER TABLE "match_lineups" DROP COLUMN "match_id",
DROP COLUMN "player_id",
ADD COLUMN     "call_up_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "match_lineups_call_up_id_key" ON "match_lineups"("call_up_id");

-- AddForeignKey
ALTER TABLE "match_call_ups" ADD CONSTRAINT "match_call_ups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_call_ups" ADD CONSTRAINT "match_call_ups_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_call_up_id_fkey" FOREIGN KEY ("call_up_id") REFERENCES "match_call_ups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

