-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "receipt_urls" TEXT[],
ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED';
