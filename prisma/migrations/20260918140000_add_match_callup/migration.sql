-- CreateEnum
CREATE TYPE "MatchSide" AS ENUM ('HOME', 'AWAY');

-- CreateTable
CREATE TABLE "match_call_ups" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "side" "MatchSide" NOT NULL,
    "is_guest" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "match_call_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_call_ups_match_id_side_idx" ON "match_call_ups"("match_id", "side");

-- CreateIndex
CREATE UNIQUE INDEX "match_call_ups_match_id_player_id_key" ON "match_call_ups"("match_id", "player_id");

-- AddForeignKey
ALTER TABLE "match_call_ups" ADD CONSTRAINT "match_call_ups_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_call_ups" ADD CONSTRAINT "match_call_ups_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
