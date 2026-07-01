/*
  Warnings:

  - You are about to drop the column `team_season_id` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `team_season_id` on the `sessions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[session_id,student_id]` on the table `session_bookings` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StatusCourseSeason" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StudentMembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'WITHDRAWN', 'FINISHED');

-- DropForeignKey
ALTER TABLE "schedules" DROP CONSTRAINT "schedules_team_season_id_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_team_season_id_fkey";

-- AlterTable
ALTER TABLE "payment_plans" ADD COLUMN     "course_season_id" TEXT,
ALTER COLUMN "team_season_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "schedules" DROP COLUMN "team_season_id";

-- AlterTable
ALTER TABLE "session_bookings" ADD COLUMN     "student_id" TEXT,
ALTER COLUMN "player_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "team_season_id";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "person_id" TEXT,
    "role_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "discipline_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "image_url" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "school_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_seasons" (
    "id" TEXT NOT NULL,
    "image_url" TEXT,
    "description" TEXT,
    "max_members" INTEGER NOT NULL,
    "min_members" INTEGER NOT NULL,
    "course_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "gender" "ProgramGender" NOT NULL,
    "billing_day" INTEGER NOT NULL,
    "registration_fee" DECIMAL(10,2) NOT NULL,
    "monthly_fee" DECIMAL(10,2) NOT NULL,
    "debt_tolerance_months" INTEGER NOT NULL DEFAULT 2,
    "late_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
    "late_fee_per_day" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusCourseSeason" NOT NULL DEFAULT 'DRAFT',
    "charge_generation_days_before" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_season_staff" (
    "id" TEXT NOT NULL,
    "course_season_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "role" "TeamSeasonStaffRole" NOT NULL,
    "custom_role" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_season_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_memberships" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "course_season_id" TEXT NOT NULL,
    "payment_plan_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "status" "StudentMembershipStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "nextMonthlyChargeGenerationDate" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_discounts" (
    "id" TEXT NOT NULL,
    "student_membership_id" TEXT NOT NULL,
    "monthly_discount_percent" DECIMAL(5,2) NOT NULL,
    "registration_discount_percent" DECIMAL(5,2) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "type" "MembershipDiscountType" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_charges" (
    "id" TEXT NOT NULL,
    "student_membership_id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "type" "TypeMembershipCharge" NOT NULL,
    "created_by_cron" BOOLEAN NOT NULL DEFAULT false,
    "billingYear" INTEGER,
    "billingMonth" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_incidents" (
    "id" TEXT NOT NULL,
    "session_booking_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_evaluations" (
    "id" TEXT NOT NULL,
    "player_id" TEXT,
    "student_id" TEXT,
    "evaluator_staff_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "evaluation_date" TIMESTAMP(3) NOT NULL,
    "technical_score" INTEGER,
    "tactical_score" INTEGER,
    "physical_score" INTEGER,
    "behavior_score" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_teams" (
    "sessionId" TEXT NOT NULL,
    "team_season_id" TEXT NOT NULL,

    CONSTRAINT "session_teams_pkey" PRIMARY KEY ("sessionId","team_season_id")
);

-- CreateTable
CREATE TABLE "session_courses" (
    "sessionId" TEXT NOT NULL,
    "course_season_id" TEXT NOT NULL,

    CONSTRAINT "session_courses_pkey" PRIMARY KEY ("sessionId","course_season_id")
);

-- CreateTable
CREATE TABLE "schedule_teams" (
    "scheduleId" TEXT NOT NULL,
    "team_season_id" TEXT NOT NULL,

    CONSTRAINT "schedule_teams_pkey" PRIMARY KEY ("scheduleId","team_season_id")
);

-- CreateTable
CREATE TABLE "schedule_courses" (
    "scheduleId" TEXT NOT NULL,
    "course_season_id" TEXT NOT NULL,

    CONSTRAINT "schedule_courses_pkey" PRIMARY KEY ("scheduleId","course_season_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_person_id_key" ON "users"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "schools_institution_id_discipline_id_name_key" ON "schools"("institution_id", "discipline_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "courses_school_id_name_key" ON "courses"("school_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "course_seasons_course_id_category_id_season_id_gender_key" ON "course_seasons"("course_id", "category_id", "season_id", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "students_person_id_key" ON "students"("person_id");

-- CreateIndex
CREATE INDEX "student_memberships_nextMonthlyChargeGenerationDate_idx" ON "student_memberships"("nextMonthlyChargeGenerationDate");

-- CreateIndex
CREATE UNIQUE INDEX "student_charges_student_membership_id_type_billingMonth_bil_key" ON "student_charges"("student_membership_id", "type", "billingMonth", "billingYear");

-- CreateIndex
CREATE UNIQUE INDEX "session_bookings_session_id_student_id_key" ON "session_bookings"("session_id", "student_id");

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_seasons" ADD CONSTRAINT "course_seasons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_seasons" ADD CONSTRAINT "course_seasons_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_seasons" ADD CONSTRAINT "course_seasons_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_staff" ADD CONSTRAINT "course_season_staff_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_staff" ADD CONSTRAINT "course_season_staff_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_student_membership_id_fkey" FOREIGN KEY ("student_membership_id") REFERENCES "student_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_student_membership_id_fkey" FOREIGN KEY ("student_membership_id") REFERENCES "student_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_incidents" ADD CONSTRAINT "session_incidents_session_booking_id_fkey" FOREIGN KEY ("session_booking_id") REFERENCES "session_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_evaluations" ADD CONSTRAINT "progress_evaluations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_evaluations" ADD CONSTRAINT "progress_evaluations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_evaluations" ADD CONSTRAINT "progress_evaluations_evaluator_staff_id_fkey" FOREIGN KEY ("evaluator_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_evaluations" ADD CONSTRAINT "progress_evaluations_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_teams" ADD CONSTRAINT "session_teams_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_teams" ADD CONSTRAINT "session_teams_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_courses" ADD CONSTRAINT "session_courses_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_courses" ADD CONSTRAINT "session_courses_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_bookings" ADD CONSTRAINT "session_bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_teams" ADD CONSTRAINT "schedule_teams_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_teams" ADD CONSTRAINT "schedule_teams_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_courses" ADD CONSTRAINT "schedule_courses_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_courses" ADD CONSTRAINT "schedule_courses_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
