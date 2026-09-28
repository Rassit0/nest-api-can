-- CreateEnum
CREATE TYPE "NewsAssetStatus" AS ENUM ('PENDING', 'ATTACHED', 'DELETE_PENDING');

-- AlterTable
ALTER TABLE "news" ADD COLUMN     "content_schema_version" INTEGER,
ADD COLUMN     "structured_content" JSONB;

-- CreateTable
CREATE TABLE "news_assets" (
    "id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "news_id" TEXT,
    "upload_session_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "status" "NewsAssetStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_assets_storage_key_key" ON "news_assets"("storage_key");

-- CreateIndex
CREATE INDEX "news_assets_upload_session_id_uploaded_by_id_status_idx" ON "news_assets"("upload_session_id", "uploaded_by_id", "status");

-- CreateIndex
CREATE INDEX "news_assets_news_id_status_idx" ON "news_assets"("news_id", "status");

-- CreateIndex
CREATE INDEX "news_assets_status_created_at_idx" ON "news_assets"("status", "created_at");

-- AddForeignKey
ALTER TABLE "news_assets" ADD CONSTRAINT "news_assets_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_assets" ADD CONSTRAINT "news_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
