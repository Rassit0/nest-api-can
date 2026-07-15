-- AlterTable
ALTER TABLE "course_seasons" ADD COLUMN     "status_notes" TEXT;

-- CreateTable
CREATE TABLE "student_membership_histories" (
    "id" TEXT NOT NULL,
    "student_membership_id" TEXT NOT NULL,
    "previous_status" "StudentMembershipStatus",
    "new_status" "StudentMembershipStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_membership_histories_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "student_membership_histories" ADD CONSTRAINT "student_membership_histories_student_membership_id_fkey" FOREIGN KEY ("student_membership_id") REFERENCES "student_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
