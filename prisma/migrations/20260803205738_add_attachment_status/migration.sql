-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING', 'LINKED', 'DELETED');

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING';
