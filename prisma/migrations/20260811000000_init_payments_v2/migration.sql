-- CreateEnum
CREATE TYPE "ChargeCategory" AS ENUM ('NORMAL', 'LATE_FEE', 'REGISTRATION');

-- AlterTable
ALTER TABLE "charges" ADD COLUMN     "charge_category" "ChargeCategory" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "payment_id" TEXT;

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "receipt_series" TEXT NOT NULL,
    "receipt_number" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_receipt_series_receipt_number_key" ON "payments"("receipt_series", "receipt_number");

-- 1. DATA CLEANUP: Detach duplicate pending late fees to avoid unique constraint violation
UPDATE "charges"
SET "parentChargeId" = NULL
WHERE "parentChargeId" IS NOT NULL 
  AND "status" = 'PENDING'
  AND "id" NOT IN (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY "parentChargeId" ORDER BY "created_at" DESC) as rn
      FROM "charges"
      WHERE "parentChargeId" IS NOT NULL
    ) ranked
    WHERE rn = 1
  );

-- 2. Update charge_category for remaining late fees to LATE_FEE
UPDATE "charges" 
SET "charge_category" = 'LATE_FEE' 
WHERE "parentChargeId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "charges_parentChargeId_charge_category_key" ON "charges"("parentChargeId", "charge_category");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DATA MIGRATION SCRIPT START

-- 1. Insert into Payments based on ChargeTransaction
INSERT INTO "payments" (
    "id",
    "charge_id",
    "receipt_series",
    "receipt_number",
    "amount",
    "status",
    "payment_date",
    "created_at",
    "updated_at",
    "created_by_id",
    "updated_by_id"
)
SELECT 
    ct."id", 
    ct."charge_id",
    t."receipt_series",
    t."receipt_number",
    ct."amount_applied",
    t."status",
    t."created_at",
    ct."created_at",
    ct."updated_at",
    ct."created_by_id",
    ct."updated_by_id"
FROM "charge_transactions" ct
JOIN "transactions" t ON ct."transaction_id" = t."id";

-- 2. Link Transactions back to the newly created Payments
UPDATE "transactions" t
SET "payment_id" = ct."id"
FROM "charge_transactions" ct
WHERE t."id" = ct."transaction_id";

-- DATA MIGRATION SCRIPT END
