/*
  Warnings:

  - The values [UPCOMING] on the enum `SeasonStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SeasonStatus_new" AS ENUM ('ACTIVE', 'FINISHED', 'CANCELLED');
ALTER TABLE "public"."seasons" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "seasons" ALTER COLUMN "status" TYPE "SeasonStatus_new" USING ("status"::text::"SeasonStatus_new");
ALTER TYPE "SeasonStatus" RENAME TO "SeasonStatus_old";
ALTER TYPE "SeasonStatus_new" RENAME TO "SeasonStatus";
DROP TYPE "public"."SeasonStatus_old";
ALTER TABLE "seasons" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterTable
ALTER TABLE "seasons" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
