-- CreateEnum
CREATE TYPE "PromotionPosition" AS ENUM ('PROMO_1', 'PROMO_2');

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cta_text" TEXT,
    "redirect_to" TEXT,
    "image_16x9" TEXT NOT NULL,
    "image_1x1" TEXT,
    "image_3x4" TEXT,
    "position" "PromotionPosition" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotions_position_idx" ON "promotions"("position");

-- CreateIndex
CREATE INDEX "promotions_position_is_active_idx" ON "promotions"("position", "is_active");

-- Create Partial Unique Index for PostgreSQL
CREATE UNIQUE INDEX "promotions_position_active_idx" ON "promotions" ("position") WHERE "is_active" = true;

-- Data Migration: Migrate Banners to Promotions
INSERT INTO "promotions" (
    "id", "title", "cta_text", "redirect_to", 
    "image_16x9", "image_1x1", "image_3x4", 
    "position", "is_active", "created_at", "updated_at"
)
SELECT 
    b."id", b."title", b."cta_text", b."redirect_to", 
    b."image_16x9", b."image_1x1", b."image_3x4", 
    CAST('PROMO_1' AS "PromotionPosition"), b."is_active", b."created_at", b."updated_at"
FROM "banners" b
JOIN "banner_categories" bc ON b."category_id" = bc."id"
WHERE bc."slug" = 'promo-1';

INSERT INTO "promotions" (
    "id", "title", "cta_text", "redirect_to", 
    "image_16x9", "image_1x1", "image_3x4", 
    "position", "is_active", "created_at", "updated_at"
)
SELECT 
    b."id", b."title", b."cta_text", b."redirect_to", 
    b."image_16x9", b."image_1x1", b."image_3x4", 
    CAST('PROMO_2' AS "PromotionPosition"), b."is_active", b."created_at", b."updated_at"
FROM "banners" b
JOIN "banner_categories" bc ON b."category_id" = bc."id"
WHERE bc."slug" = 'promo-2';

-- Delete Migrated Banners
DELETE FROM "banners" WHERE "category_id" IN (
    SELECT "id" FROM "banner_categories" WHERE "slug" IN ('promo-1', 'promo-2')
);

-- Delete Old Banner Categories
DELETE FROM "banner_categories" WHERE "slug" IN ('promo-1', 'promo-2');
