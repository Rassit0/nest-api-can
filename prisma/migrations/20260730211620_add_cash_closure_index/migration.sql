-- CreateIndex
CREATE INDEX "cash_closures_financial_account_id_closed_at_idx" ON "cash_closures"("financial_account_id", "closed_at" DESC);
