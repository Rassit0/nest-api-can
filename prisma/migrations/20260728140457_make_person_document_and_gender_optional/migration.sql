-- AlterTable
ALTER TABLE "persons" ALTER COLUMN "document_type" DROP NOT NULL,
ALTER COLUMN "document_number" DROP NOT NULL,
ALTER COLUMN "gender" DROP NOT NULL;
