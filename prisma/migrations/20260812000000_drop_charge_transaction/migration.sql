-- DropForeignKey
ALTER TABLE "charge_transactions" DROP CONSTRAINT "charge_transactions_charge_id_fkey";

-- DropForeignKey
ALTER TABLE "charge_transactions" DROP CONSTRAINT "charge_transactions_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "charge_transactions" DROP CONSTRAINT "charge_transactions_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "charge_transactions" DROP CONSTRAINT "charge_transactions_updated_by_id_fkey";

-- DropTable
DROP TABLE "charge_transactions";
