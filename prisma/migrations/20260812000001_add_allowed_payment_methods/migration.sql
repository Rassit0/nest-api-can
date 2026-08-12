-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_payment_id_fkey";

-- AlterTable
ALTER TABLE "financial_accounts" ADD COLUMN     "allowed_payment_methods" "PaymentMethod"[] DEFAULT ARRAY[]::"PaymentMethod"[];

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data Migration
UPDATE "financial_accounts" SET "allowed_payment_methods" = ARRAY['CASH']::"PaymentMethod"[] WHERE "id" = '5c7c1531-9b9d-4000-bd1c-e01202461245';
UPDATE "financial_accounts" SET "allowed_payment_methods" = ARRAY['QR', 'CASH']::"PaymentMethod"[] WHERE "id" = 'd7e173bd-f5e3-4dbf-9245-57835d0c3fef';
