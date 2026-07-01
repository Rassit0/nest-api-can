/*
  Warnings:

  - The values [PENDING] on the enum `PlayerMembershipStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PlayerMembershipStatus_new" AS ENUM ('PENDING_ACTIVE', 'ACTIVE', 'SUSPENDED', 'WITHDRAWN', 'FINISHED');
ALTER TABLE "public"."player_membership" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "player_membership" ALTER COLUMN "status" TYPE "PlayerMembershipStatus_new" USING ("status"::text::"PlayerMembershipStatus_new");
ALTER TYPE "PlayerMembershipStatus" RENAME TO "PlayerMembershipStatus_old";
ALTER TYPE "PlayerMembershipStatus_new" RENAME TO "PlayerMembershipStatus";
DROP TYPE "public"."PlayerMembershipStatus_old";
ALTER TABLE "player_membership" ALTER COLUMN "status" SET DEFAULT 'PENDING_ACTIVE';
COMMIT;

-- AlterTable
ALTER TABLE "player_membership" ALTER COLUMN "status" SET DEFAULT 'PENDING_ACTIVE';
