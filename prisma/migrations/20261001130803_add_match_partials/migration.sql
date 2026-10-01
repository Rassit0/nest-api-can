-- CreateTable
CREATE TABLE "match_partials" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT,
    "home_score" INTEGER,
    "away_score" INTEGER,

    CONSTRAINT "match_partials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_partials_match_id_idx" ON "match_partials"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_partials_match_id_sequence_key" ON "match_partials"("match_id", "sequence");

-- AddForeignKey
ALTER TABLE "match_partials" ADD CONSTRAINT "match_partials_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
