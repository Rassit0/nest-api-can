-- Move existing receipts to attachments table (Data Migration)
INSERT INTO "attachments" ("id", "transaction_id", "url", "original_name", "internal_name", "mime_type", "size_bytes", "created_at", "updated_at")
SELECT 
  gen_random_uuid()::text, 
  "id", 
  unnest("receipt_urls"), 
  'Comprobante Migrado', 
  'migrated_' || gen_random_uuid()::text, 
  'image/jpeg', 
  0, 
  now(), 
  now()
FROM "transactions"
WHERE "receipt_urls" IS NOT NULL AND array_length("receipt_urls", 1) > 0;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "receipt_urls";
