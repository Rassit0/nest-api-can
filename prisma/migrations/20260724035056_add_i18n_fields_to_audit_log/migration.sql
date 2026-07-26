-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "message_key" TEXT,
ADD COLUMN     "message_params" JSONB,
ADD COLUMN     "title_key" TEXT,
ADD COLUMN     "type" TEXT;
