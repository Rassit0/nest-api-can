-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CI', 'NIT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ContactRelationship" AS ENUM ('FATHER', 'MOTHER', 'BROTHER', 'SISTER', 'SPOUSE', 'PARTNER', 'UNCLE', 'AUNT', 'GRANDPARENT', 'FRIEND', 'TUTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProgramGender" AS ENUM ('MALE', 'FEMALE', 'MIXED');

-- CreateEnum
CREATE TYPE "StatusOffering" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlayerMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'WITHDRAWN', 'FINISHED');

-- CreateEnum
CREATE TYPE "MembershipDiscountType" AS ENUM ('SCHOLARSHIP', 'SPECIAL_DISCOUNT', 'FINANCIAL_AID', 'AGREEMENT', 'EXEMPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "TeamSeasonStaffRole" AS ENUM ('HEAD_COACH', 'ASSISTANT_COACH', 'ASSISTANT', 'VOLUNTEER', 'DELEGATE', 'OTHER');

-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "second_last_name" TEXT,
    "birth_date" TIMESTAMP(3),
    "image_url" TEXT,
    "document_type" "DocumentType" NOT NULL,
    "document_number" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gender" "Gender" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_contacts" (
    "personId" TEXT NOT NULL,
    "contactPersonId" TEXT NOT NULL,
    "relationship" "ContactRelationship" NOT NULL,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "isBillingContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_contacts_pkey" PRIMARY KEY ("personId","contactPersonId")
);

-- CreateTable
CREATE TABLE "disciplines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disciplines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "discipline_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "description" TEXT,
    "phone" TEXT,
    "google_maps_url" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "is_rentable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "max_age" INTEGER NOT NULL,
    "min_age" INTEGER NOT NULL,
    "discipline_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "discipline_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "image_url" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "club_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_seasons" (
    "id" TEXT NOT NULL,
    "image_url" TEXT,
    "description" TEXT,
    "max_members" INTEGER NOT NULL,
    "min_members" INTEGER NOT NULL,
    "team_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "gender" "ProgramGender" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_membership_offerings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "team_season_id" TEXT NOT NULL,
    "billing_day" INTEGER NOT NULL,
    "registration_fee" DECIMAL(10,2) NOT NULL,
    "monthly_fee" DECIMAL(10,2) NOT NULL,
    "late_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
    "late_fee_per_day" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusOffering" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_membership_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_membership" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "team_membership_offering_id" TEXT NOT NULL,
    "payment_plan_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "status" "PlayerMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_plans" (
    "id" TEXT NOT NULL,
    "team_membership_offering_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registration_discount_percent" DECIMAL(5,2) NOT NULL,
    "monthly_discount_percent" DECIMAL(5,2) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_discounts" (
    "id" TEXT NOT NULL,
    "player_membership_id" TEXT NOT NULL,
    "monthly_discount_percent" DECIMAL(5,2) NOT NULL,
    "registration_discount_percent" DECIMAL(5,2) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "type" "MembershipDiscountType" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_season_staff" (
    "id" TEXT NOT NULL,
    "team_season_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "role" "TeamSeasonStaffRole" NOT NULL,
    "custom_role" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_season_staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "persons_document_number_key" ON "persons"("document_number");

-- CreateIndex
CREATE UNIQUE INDEX "persons_email_key" ON "persons"("email");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_email_key" ON "institutions"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_institution_id_discipline_id_name_key" ON "clubs"("institution_id", "discipline_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_discipline_id_name_key" ON "categories"("discipline_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_institution_id_discipline_id_name_key" ON "seasons"("institution_id", "discipline_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "teams_club_id_name_key" ON "teams"("club_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "team_seasons_team_id_category_id_season_id_gender_key" ON "team_seasons"("team_id", "category_id", "season_id", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "team_membership_offerings_team_season_id_name_key" ON "team_membership_offerings"("team_season_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "players_personId_key" ON "players"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_person_id_key" ON "staff"("person_id");

-- AddForeignKey
ALTER TABLE "person_contacts" ADD CONSTRAINT "person_contacts_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_contacts" ADD CONSTRAINT "person_contacts_contactPersonId_fkey" FOREIGN KEY ("contactPersonId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_membership_offerings" ADD CONSTRAINT "team_membership_offerings_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership" ADD CONSTRAINT "player_membership_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership" ADD CONSTRAINT "player_membership_team_membership_offering_id_fkey" FOREIGN KEY ("team_membership_offering_id") REFERENCES "team_membership_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership" ADD CONSTRAINT "player_membership_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_team_membership_offering_id_fkey" FOREIGN KEY ("team_membership_offering_id") REFERENCES "team_membership_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_discounts" ADD CONSTRAINT "membership_discounts_player_membership_id_fkey" FOREIGN KEY ("player_membership_id") REFERENCES "player_membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_staff" ADD CONSTRAINT "team_season_staff_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_staff" ADD CONSTRAINT "team_season_staff_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
