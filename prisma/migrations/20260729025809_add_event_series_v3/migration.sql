/*
  Warnings:

  - You are about to drop the column `recurrence_group_id` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `recurrence_rule` on the `events` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EventSeriesStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "EventExceptionType" AS ENUM ('NONE', 'MOVED', 'MODIFIED', 'CANCELLED');

-- DropIndex
DROP INDEX "events_recurrence_group_id_idx";

-- AlterTable
ALTER TABLE "events" DROP COLUMN "recurrence_group_id",
DROP COLUMN "recurrence_rule",
ADD COLUMN     "event_series_id" TEXT,
ADD COLUMN     "exception_type" "EventExceptionType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "original_start_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "event_series" (
    "id" TEXT NOT NULL,
    "recurrence_rule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "template_data" JSONB NOT NULL,
    "template_version" INTEGER NOT NULL DEFAULT 1,
    "materialized_until" TIMESTAMP(3) NOT NULL,
    "last_materialized_at" TIMESTAMP(3),
    "status" "EventSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "event_series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_event_series_id_idx" ON "events"("event_series_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_event_series_id_fkey" FOREIGN KEY ("event_series_id") REFERENCES "event_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateUniqueIndex
CREATE UNIQUE INDEX "events_event_series_id_original_start_date_key" ON "events"("event_series_id", "original_start_date");
