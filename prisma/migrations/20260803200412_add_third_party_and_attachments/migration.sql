-- CreateEnum
CREATE TYPE "ThirdPartyType" AS ENUM ('PROVIDER', 'CLIENT', 'INSTITUTION', 'OTHER');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "third_party_id" TEXT;

-- CreateTable
CREATE TABLE "third_parties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ThirdPartyType" NOT NULL DEFAULT 'PROVIDER',
    "document_type" TEXT,
    "document_number" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "third_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "internal_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "url" TEXT,
    "path" TEXT,
    "transaction_id" TEXT,
    "uploaded_by_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_internal_name_key" ON "attachments"("internal_name");

-- CreateIndex
CREATE INDEX "attachments_transaction_id_idx" ON "attachments"("transaction_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_third_party_id_fkey" FOREIGN KEY ("third_party_id") REFERENCES "third_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
