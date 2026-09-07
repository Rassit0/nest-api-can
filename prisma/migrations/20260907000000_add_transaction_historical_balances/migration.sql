-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "balance_after" DECIMAL(10,2),
ADD COLUMN     "balance_before" DECIMAL(10,2),
ADD COLUMN     "reverses_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reverses_id_key" ON "transactions"("reverses_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
