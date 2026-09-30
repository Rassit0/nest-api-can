/*
  Safe Additive/Rename Migration
*/

-- Rename Enum
ALTER TYPE "ThirdPartyType" RENAME TO "CompanyType";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_third_party_id_fkey";

-- Rename Table and Columns
ALTER TABLE "third_parties" RENAME TO "companies";
ALTER TABLE "companies" RENAME CONSTRAINT "third_parties_pkey" TO "companies_pkey";
ALTER TABLE "companies" RENAME COLUMN "document_number" TO "tax_id";
ALTER TABLE "companies" RENAME COLUMN "contact_email" TO "email";
ALTER TABLE "companies" RENAME COLUMN "contact_phone" TO "phone";
ALTER TABLE "transactions" RENAME COLUMN "third_party_id" TO "payer_company_id";

-- AlterTable (Add new columns)
ALTER TABLE "companies" ADD COLUMN "legal_name" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "created_by_id" TEXT,
ADD COLUMN "updated_by_id" TEXT;

-- AlterTable Account Charges
ALTER TABLE "account_charges" ADD COLUMN "company_id" TEXT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payer_company_id_fkey" FOREIGN KEY ("payer_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_charges" ADD CONSTRAINT "account_charges_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
