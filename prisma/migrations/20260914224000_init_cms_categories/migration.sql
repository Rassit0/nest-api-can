-- DropForeignKey
ALTER TABLE "cycle_enrollments" DROP CONSTRAINT IF EXISTS "cycle_enrollments_course_season_shift_id_fkey";

-- DropForeignKey
ALTER TABLE "student_memberships" DROP CONSTRAINT IF EXISTS "student_memberships_course_season_shift_id_fkey";

-- AlterTable
ALTER TABLE "banners" ADD COLUMN     "category_id" TEXT;

-- AlterTable
ALTER TABLE "course_season_shifts" ALTER COLUMN "gender" DROP DEFAULT;

-- AlterTable
ALTER TABLE "news" ADD COLUMN     "category_id" TEXT;

-- CreateTable
CREATE TABLE "news_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banner_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banner_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_categories_name_key" ON "news_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "news_categories_slug_key" ON "news_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "banner_categories_name_key" ON "banner_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "banner_categories_slug_key" ON "banner_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "course_season_shifts_id_course_season_id_key" ON "course_season_shifts"("id", "course_season_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "course_seasons_course_id_season_id_name_key" ON "course_seasons"("course_id", "season_id", "name");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_memberships_course_season_shift_id_course_season_i_fkey') THEN
        ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_course_season_shift_id_course_season_i_fkey" FOREIGN KEY ("course_season_shift_id", "course_season_id") REFERENCES "course_season_shifts"("id", "course_season_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cycle_enrollments_course_season_shift_id_course_season_id_fkey') THEN
        ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_course_season_shift_id_course_season_id_fkey" FOREIGN KEY ("course_season_shift_id", "course_season_id") REFERENCES "course_season_shifts"("id", "course_season_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "news_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "banner_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

