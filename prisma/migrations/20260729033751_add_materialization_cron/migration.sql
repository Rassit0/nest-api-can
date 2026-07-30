-- AlterTable
ALTER TABLE "event_series" ADD COLUMN     "locked_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "event_materialization_logs" (
    "id" TEXT NOT NULL,
    "event_series_id" TEXT NOT NULL,
    "generated_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_materialization_logs_pkey" PRIMARY KEY ("id")
);
