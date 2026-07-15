/*
  Warnings:

  - The values [PENDING] on the enum `StudentMembershipStatus` will be removed. If these variants are still used in the database, this will fail.
  - Changed the type of `role` on the `course_season_staff` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CourseSeasonStaffRole" AS ENUM ('HEAD_COACH', 'ASSISTANT_COACH', 'ASSISTANT', 'VOLUNTEER', 'DELEGATE', 'OTHER');

-- AlterEnum
BEGIN;
CREATE TYPE "StudentMembershipStatus_new" AS ENUM ('PENDING_ACTIVE', 'ACTIVE', 'SUSPENDED', 'WITHDRAWN', 'FINISHED');
ALTER TABLE "public"."student_memberships" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "student_memberships" ALTER COLUMN "status" TYPE "StudentMembershipStatus_new" USING ("status"::text::"StudentMembershipStatus_new");
ALTER TABLE "student_membership_histories" ALTER COLUMN "previous_status" TYPE "StudentMembershipStatus_new" USING ("previous_status"::text::"StudentMembershipStatus_new");
ALTER TABLE "student_membership_histories" ALTER COLUMN "new_status" TYPE "StudentMembershipStatus_new" USING ("new_status"::text::"StudentMembershipStatus_new");
ALTER TYPE "StudentMembershipStatus" RENAME TO "StudentMembershipStatus_old";
ALTER TYPE "StudentMembershipStatus_new" RENAME TO "StudentMembershipStatus";
DROP TYPE "public"."StudentMembershipStatus_old";
ALTER TABLE "student_memberships" ALTER COLUMN "status" SET DEFAULT 'PENDING_ACTIVE';
COMMIT;

-- AlterTable
ALTER TABLE "course_season_staff" DROP COLUMN "role",
ADD COLUMN     "role" "CourseSeasonStaffRole" NOT NULL;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "short_name" TEXT;

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "short_name" TEXT;

-- AlterTable
ALTER TABLE "student_memberships" ALTER COLUMN "status" SET DEFAULT 'PENDING_ACTIVE';
