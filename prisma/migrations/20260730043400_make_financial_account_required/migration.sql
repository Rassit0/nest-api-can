/*
  Warnings:

  - Made the column `financial_account_id` on table `transactions` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_financial_account_id_fkey";

-- DATA MIGRATION: Create default Caja General if it does not exist
INSERT INTO "financial_accounts" ("id", "name", "description", "type", "currency", "initial_balance", "cached_balance", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), 'Caja General', 'Cuenta por defecto para transacciones migradas', 'CASH', 'BOB', 0, 0, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "financial_accounts" WHERE "name" = 'Caja General');

-- DATA MIGRATION: Link existing transactions to Caja General
UPDATE "transactions"
SET "financial_account_id" = (SELECT "id" FROM "financial_accounts" WHERE "name" = 'Caja General' LIMIT 1)
WHERE "financial_account_id" IS NULL;

-- DATA MIGRATION: Recalculate cached balance based on transactions
UPDATE "financial_accounts"
SET "cached_balance" = "initial_balance" + COALESCE(
  (SELECT SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END)
   FROM "transactions"
   WHERE "financial_account_id" = "financial_accounts"."id" AND "status" = 'COMPLETED'), 0
)
WHERE "name" = 'Caja General';

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "financial_account_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
