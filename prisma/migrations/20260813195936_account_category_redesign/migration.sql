-- AlterTable
ALTER TABLE "account_categories" ADD COLUMN     "code" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_id" TEXT,
ADD COLUMN     "receipt_series" TEXT;

-- Backfill code for existing categories
UPDATE "account_categories" 
SET "code" = SUBSTRING(UPPER(REPLACE("name", ' ', '')), 1, 4) || '-' || SUBSTRING("id", 1, 4) 
WHERE "code" IS NULL;

ALTER TABLE "account_categories" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "account_categories_code_key" ON "account_categories"("code");

-- AlterTable
ALTER TABLE "clubs" ADD COLUMN     "default_account_category_id" TEXT;

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "default_account_category_id" TEXT;

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_default_account_category_id_fkey" FOREIGN KEY ("default_account_category_id") REFERENCES "account_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_default_account_category_id_fkey" FOREIGN KEY ("default_account_category_id") REFERENCES "account_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_categories" ADD CONSTRAINT "account_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "account_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
