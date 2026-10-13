-- AlterTable
ALTER TABLE "internal_transfers" ADD COLUMN     "receipt_number" INTEGER,
ADD COLUMN     "receipt_series" TEXT;

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "receipt_number" DROP NOT NULL,
ALTER COLUMN "receipt_series" DROP NOT NULL,
ALTER COLUMN "receipt_series" DROP DEFAULT;
