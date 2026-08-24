-- CreateEnum
CREATE TYPE "StudentMembershipSuspensionReason" AS ENUM ('PAUSE', 'MANUAL');

-- AlterTable
ALTER TABLE "student_memberships" ADD COLUMN     "suspension_reason" "StudentMembershipSuspensionReason";
