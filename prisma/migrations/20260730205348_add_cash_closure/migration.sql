-- CreateTable
CREATE TABLE "cash_closures" (
    "id" TEXT NOT NULL,
    "financial_account_id" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_balance" DECIMAL(12,2) NOT NULL,
    "actual_balance" DECIMAL(12,2) NOT NULL,
    "difference" DECIMAL(12,2) NOT NULL,
    "observations" TEXT,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "cash_closures_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
