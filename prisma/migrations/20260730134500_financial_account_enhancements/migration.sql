-- AlterTable
ALTER TABLE "financial_accounts" DROP COLUMN "initial_balance",
ADD COLUMN     "account_number" TEXT,
ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_reconciled_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "only_one_default" ON "financial_accounts"("is_default") WHERE "is_default" = true;
