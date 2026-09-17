/*
  Warnings:

  - You are about to drop the `banner_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `banners` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "banners" DROP CONSTRAINT "banners_category_id_fkey";

-- DropTable
DROP TABLE "banner_categories";

-- DropTable
DROP TABLE "banners";

-- CreateTable
CREATE TABLE "hero_banners" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cta_text" TEXT,
    "redirect_to" TEXT,
    "image_16x9" TEXT NOT NULL,
    "image_1x1" TEXT,
    "image_3x4" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hero_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_disciplines" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "redirect_to" TEXT,
    "image_4x3" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_disciplines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hero_banners_is_active_idx" ON "hero_banners"("is_active");

-- CreateIndex
CREATE INDEX "hero_banners_sort_order_idx" ON "hero_banners"("sort_order");

-- CreateIndex
CREATE INDEX "home_disciplines_is_active_idx" ON "home_disciplines"("is_active");

-- CreateIndex
CREATE INDEX "home_disciplines_sort_order_idx" ON "home_disciplines"("sort_order");
