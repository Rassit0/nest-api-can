-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PromotionPosition" AS ENUM ('PROMO_1', 'PROMO_2');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CI', 'NIT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ContactRelationship" AS ENUM ('FATHER', 'MOTHER', 'BROTHER', 'SISTER', 'SPOUSE', 'PARTNER', 'UNCLE', 'AUNT', 'GRANDPARENT', 'FRIEND', 'TUTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SeasonEventType" AS ENUM ('EXTENSION', 'FINALIZATION', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "ProgramGender" AS ENUM ('MALE', 'FEMALE', 'MIXED');

-- CreateEnum
CREATE TYPE "StatusTeamSeason" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeamSeasonCategoryStatus" AS ENUM ('ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "SeasonBillingType" AS ENUM ('MONTHLY_ONLY', 'SINGLE_ONLY', 'BOTH');

-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('MONTHLY', 'WEEKLY', 'BIWEEKLY', 'SINGLE');

-- CreateEnum
CREATE TYPE "PlayerMembershipStatus" AS ENUM ('PENDING_ACTIVE', 'ACTIVE', 'SUSPENDED', 'WITHDRAWN', 'FINISHED');

-- CreateEnum
CREATE TYPE "MembershipDiscountType" AS ENUM ('SCHOLARSHIP', 'SPECIAL_DISCOUNT', 'FINANCIAL_AID', 'AGREEMENT', 'EXEMPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "TypeMembershipCharge" AS ENUM ('REGISTRATION', 'RECURRING_FEE', 'SEASON_FEE', 'LATE_FEE', 'MANUAL');

-- CreateEnum
CREATE TYPE "TeamSeasonStaffRole" AS ENUM ('HEAD_COACH', 'ASSISTANT_COACH', 'ASSISTANT', 'VOLUNTEER', 'DELEGATE', 'OTHER');

-- CreateEnum
CREATE TYPE "StatusCharge" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChargeDirection" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "ChargeCategory" AS ENUM ('NORMAL', 'LATE_FEE', 'REGISTRATION');

-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('CASH', 'BANK', 'DIGITAL_WALLET');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('QR', 'TRANSFER', 'CASH');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StatusCourseSeason" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CourseSeasonStaffRole" AS ENUM ('HEAD_COACH', 'ASSISTANT_COACH', 'ASSISTANT', 'VOLUNTEER', 'DELEGATE', 'OTHER');

-- CreateEnum
CREATE TYPE "StudentMembershipStatus" AS ENUM ('PENDING_ACTIVE', 'ACTIVE', 'SUSPENDED', 'WITHDRAWN', 'FINISHED');

-- CreateEnum
CREATE TYPE "StudentMembershipSuspensionReason" AS ENUM ('PAUSE', 'MANUAL');

-- CreateEnum
CREATE TYPE "CycleEnrollmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SESSION', 'MATCH', 'GENERAL', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventSeriesStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "EventExceptionType" AS ENUM ('NONE', 'MOVED', 'MODIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('FRIENDLY', 'LEAGUE', 'TOURNAMENT', 'CUP');

-- CreateEnum
CREATE TYPE "MatchResult" AS ENUM ('WIN', 'LOSS', 'DRAW', 'PENDING');

-- CreateEnum
CREATE TYPE "AccountReferenceType" AS ENUM ('PURCHASE_ORDER', 'CONTRACT', 'EVENT', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ThirdPartyType" AS ENUM ('PROVIDER', 'CLIENT', 'INSTITUTION', 'OTHER');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING', 'LINKED', 'DELETED');

-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MatchSide" AS ENUM ('HOME', 'AWAY');

-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "second_last_name" TEXT,
    "birth_date" TIMESTAMP(3),
    "image_url" TEXT,
    "document_type" "DocumentType",
    "document_number" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gender" "Gender",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

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
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "disciplines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "google_maps_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_contacts" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "institution_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "institution_id" TEXT NOT NULL,
    "discipline_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "default_account_category_id" TEXT,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "image_url" TEXT,

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
    "parent_id" TEXT,
    "max_concurrent_events" INTEGER DEFAULT 1,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "max_age" INTEGER,
    "min_age" INTEGER NOT NULL,
    "discipline_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

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
    "status" "SeasonStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_events" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "event_type" "SeasonEventType" NOT NULL,
    "original_end_date" TIMESTAMP(3),
    "new_end_date" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "season_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "image_url" TEXT,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "description" TEXT,
    "club_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_seasons" (
    "id" TEXT NOT NULL,
    "image_url" TEXT,
    "description" TEXT,
    "team_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "status" "StatusTeamSeason" NOT NULL DEFAULT 'DRAFT',
    "status_notes" TEXT,
    "is_registration_open" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "team_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_season_billing_configs" (
    "id" TEXT NOT NULL,
    "team_season_id" TEXT NOT NULL,
    "is_engine_active" BOOLEAN NOT NULL DEFAULT true,
    "billing_day" INTEGER NOT NULL,
    "registration_fee" DECIMAL(10,2),
    "recurring_fee" DECIMAL(10,2),
    "season_fee" DECIMAL(10,2),
    "debt_tolerance_months" INTEGER NOT NULL DEFAULT 2,
    "late_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
    "late_fee_per_day" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "billing_type" "SeasonBillingType" NOT NULL DEFAULT 'MONTHLY_ONLY',
    "billing_frequency" "BillingFrequency" NOT NULL DEFAULT 'MONTHLY',
    "prorate_first_recurring_fee" BOOLEAN NOT NULL DEFAULT true,
    "prorate_last_recurring_fee" BOOLEAN NOT NULL DEFAULT true,
    "prorate_registration_fee" BOOLEAN NOT NULL DEFAULT false,
    "prorate_season_fee" BOOLEAN NOT NULL DEFAULT false,
    "charge_generation_days_before" INTEGER NOT NULL DEFAULT 7,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "team_season_billing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_plans" (
    "id" TEXT NOT NULL,
    "team_season_id" TEXT,
    "course_season_id" TEXT,
    "name" TEXT NOT NULL,
    "registration_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "recurring_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "season_fee_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "is_single_payment" BOOLEAN NOT NULL DEFAULT false,
    "advance_cycles" INTEGER NOT NULL DEFAULT 1,
    "advance_cycles_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "promotional_cycles" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_membership" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "team_season_id" TEXT NOT NULL,
    "payment_plan_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "status" "PlayerMembershipStatus" NOT NULL DEFAULT 'PENDING_ACTIVE',
    "notes" TEXT,
    "nextRecurringChargeGenerationDate" TIMESTAMP(3),
    "is_migrated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "teamSeasonCategoryId" TEXT NOT NULL,

    CONSTRAINT "player_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_membership_histories" (
    "id" TEXT NOT NULL,
    "player_membership_id" TEXT NOT NULL,
    "previous_status" "PlayerMembershipStatus",
    "new_status" "PlayerMembershipStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "player_membership_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_membership_pauses" (
    "id" TEXT NOT NULL,
    "player_membership_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "player_membership_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_discounts" (
    "id" TEXT NOT NULL,
    "player_membership_id" TEXT NOT NULL,
    "recurring_discount_percent" DECIMAL(5,2) NOT NULL,
    "registration_discount_percent" DECIMAL(5,2) NOT NULL,
    "season_fee_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "type" "MembershipDiscountType" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "membership_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_charges" (
    "id" TEXT NOT NULL,
    "player_membership_id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "type" "TypeMembershipCharge" NOT NULL,
    "created_by_cron" BOOLEAN NOT NULL DEFAULT false,
    "billingYear" INTEGER,
    "billingMonth" INTEGER,
    "billing_cycle" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "membership_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_season_staff" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "role" "TeamSeasonStaffRole" NOT NULL,
    "custom_role" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "teamSeasonCategoryId" TEXT NOT NULL,

    CONSTRAINT "team_season_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charges" (
    "id" TEXT NOT NULL,
    "parentChargeId" TEXT,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "pending_amount" DECIMAL(10,2) NOT NULL,
    "adjustment_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "adjustment_reason" TEXT,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "StatusCharge" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "direction" "ChargeDirection" NOT NULL DEFAULT 'RECEIVABLE',
    "charge_category" "ChargeCategory" NOT NULL DEFAULT 'NORMAL',

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "receipt_series" TEXT NOT NULL,
    "receipt_number" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "FinancialAccountType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BOB',
    "cached_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "account_number" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "last_reconciled_at" TIMESTAMP(3),
    "allowed_payment_methods" "PaymentMethod"[] DEFAULT ARRAY[]::"PaymentMethod"[],

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "receipt_number" INTEGER NOT NULL,
    "payer_person_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "type" "TransactionType" NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "reference_number" TEXT,
    "notes" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "receipt_series" TEXT NOT NULL DEFAULT 'GEN',
    "financial_account_id" TEXT NOT NULL,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciled_at" TIMESTAMP(3),
    "reference_group_id" TEXT,
    "is_internal_transfer" BOOLEAN NOT NULL DEFAULT false,
    "third_party_id" TEXT,
    "payment_id" TEXT,
    "balance_after" DECIMAL(10,2),
    "balance_before" DECIMAL(10,2),
    "reverses_id" TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_transfers" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'COMPLETED',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_transaction_id" TEXT NOT NULL,
    "destination_transaction_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_sequences" (
    "id" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "description" TEXT,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "person_id" TEXT,
    "role_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
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
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

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
    "short_name" TEXT,
    "institution_id" TEXT NOT NULL,
    "discipline_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "default_account_category_id" TEXT,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "image_url" TEXT,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "description" TEXT,
    "school_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_seasons" (
    "id" TEXT NOT NULL,
    "image_url" TEXT,
    "description" TEXT,
    "course_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "status" "StatusCourseSeason" NOT NULL DEFAULT 'DRAFT',
    "status_notes" TEXT,
    "is_registration_open" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Regular',

    CONSTRAINT "course_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_season_shifts" (
    "id" TEXT NOT NULL,
    "course_season_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "max_members" INTEGER NOT NULL,
    "min_members" INTEGER NOT NULL,
    "category_id" TEXT NOT NULL,
    "gender" "ProgramGender" NOT NULL,
    "min_birth_year" INTEGER,
    "max_birth_year" INTEGER,
    "validate_age" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "course_season_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_season_pauses" (
    "id" TEXT NOT NULL,
    "team_season_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "team_season_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_season_pauses" (
    "id" TEXT NOT NULL,
    "course_season_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "course_season_shift_id" TEXT,

    CONSTRAINT "course_season_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_season_billing_configs" (
    "id" TEXT NOT NULL,
    "course_season_id" TEXT NOT NULL,
    "billing_day" INTEGER NOT NULL,
    "registration_fee" DECIMAL(10,2),
    "recurring_fee" DECIMAL(10,2),
    "season_fee" DECIMAL(10,2),
    "debt_tolerance_months" INTEGER NOT NULL DEFAULT 2,
    "late_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
    "late_fee_per_day" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "billing_type" "SeasonBillingType" NOT NULL DEFAULT 'MONTHLY_ONLY',
    "billing_frequency" "BillingFrequency" NOT NULL DEFAULT 'MONTHLY',
    "prorate_first_recurring_fee" BOOLEAN NOT NULL DEFAULT true,
    "prorate_last_recurring_fee" BOOLEAN NOT NULL DEFAULT true,
    "prorate_registration_fee" BOOLEAN NOT NULL DEFAULT false,
    "prorate_season_fee" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "proration_enabled" BOOLEAN NOT NULL DEFAULT true,
    "charge_generation_days_before" INTEGER NOT NULL DEFAULT 7,
    "is_engine_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "course_season_billing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_season_staff" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "role" "CourseSeasonStaffRole" NOT NULL,
    "custom_role" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "course_season_shift_id" TEXT NOT NULL,

    CONSTRAINT "course_season_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

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
    "status" "StudentMembershipStatus" NOT NULL DEFAULT 'PENDING_ACTIVE',
    "notes" TEXT,
    "is_migrated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "nextRecurringChargeGenerationDate" TIMESTAMP(3),
    "course_season_shift_id" TEXT NOT NULL,
    "suspension_reason" "StudentMembershipSuspensionReason",

    CONSTRAINT "student_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_membership_histories" (
    "id" TEXT NOT NULL,
    "student_membership_id" TEXT NOT NULL,
    "previous_status" "StudentMembershipStatus",
    "new_status" "StudentMembershipStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "student_membership_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_membership_pauses" (
    "id" TEXT NOT NULL,
    "student_membership_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "student_membership_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_enrollments" (
    "id" TEXT NOT NULL,
    "student_membership_id" TEXT NOT NULL,
    "charge_id" TEXT,
    "cycle_start_date" TIMESTAMP(3) NOT NULL,
    "cycle_end_date" TIMESTAMP(3) NOT NULL,
    "effective_start_date" TIMESTAMP(3) NOT NULL,
    "status" "CycleEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "course_season_id" TEXT NOT NULL,
    "course_season_shift_id" TEXT NOT NULL,

    CONSTRAINT "cycle_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_discounts" (
    "id" TEXT NOT NULL,
    "student_membership_id" TEXT NOT NULL,
    "recurring_discount_percent" DECIMAL(5,2) NOT NULL,
    "registration_discount_percent" DECIMAL(5,2) NOT NULL,
    "season_fee_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "type" "MembershipDiscountType" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

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
    "billing_cycle" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "student_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_incidents" (
    "id" TEXT NOT NULL,
    "session_booking_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

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
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "progress_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_series" (
    "id" TEXT NOT NULL,
    "recurrence_rule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "template_data" JSONB NOT NULL,
    "template_version" INTEGER NOT NULL DEFAULT 1,
    "materialized_until" TIMESTAMP(3) NOT NULL,
    "last_materialized_at" TIMESTAMP(3),
    "status" "EventSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "locked_until" TIMESTAMP(3),

    CONSTRAINT "event_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "location_id" TEXT,
    "event_type" "EventType" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "event_series_id" TEXT,
    "exception_type" "EventExceptionType" NOT NULL DEFAULT 'NONE',
    "original_start_date" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "general_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "institution_id" TEXT,
    "course_season_id" TEXT,
    "course_season_shift_id" TEXT,
    "teamSeasonCategoryId" TEXT,

    CONSTRAINT "general_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "duration_min" INTEGER NOT NULL DEFAULT 90,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_teams" (
    "sessionId" TEXT NOT NULL,
    "teamSeasonCategoryId" TEXT NOT NULL,

    CONSTRAINT "session_teams_pkey" PRIMARY KEY ("sessionId","teamSeasonCategoryId")
);

-- CreateTable
CREATE TABLE "session_courses" (
    "sessionId" TEXT NOT NULL,
    "course_season_shift_id" TEXT NOT NULL,

    CONSTRAINT "session_courses_pkey" PRIMARY KEY ("sessionId","course_season_shift_id")
);

-- CreateTable
CREATE TABLE "session_bookings" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "player_id" TEXT,
    "student_id" TEXT,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "charge_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "session_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" "MatchType" NOT NULL DEFAULT 'LEAGUE',
    "result" "MatchResult" NOT NULL DEFAULT 'PENDING',
    "away_score" INTEGER,
    "away_team_id" TEXT NOT NULL,
    "home_score" INTEGER,
    "home_team_id" TEXT NOT NULL,
    "team_season_category_id" TEXT,
    "home_team_season_category_id" TEXT,
    "away_team_season_category_id" TEXT,
    "competition_name" TEXT,
    "home_coach_id" TEXT,
    "home_coach_name" TEXT,
    "away_coach_id" TEXT,
    "away_coach_name" TEXT,
    "home_call_up_configured_at" TIMESTAMP(3),
    "away_call_up_configured_at" TIMESTAMP(3),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_call_ups" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "side" "MatchSide" NOT NULL,
    "is_guest" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "match_call_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_lineups" (
    "id" TEXT NOT NULL,
    "call_up_id" TEXT NOT NULL,
    "minutes_played" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "yellow_cards" INTEGER NOT NULL DEFAULT 0,
    "red_cards" INTEGER NOT NULL DEFAULT 0,
    "is_starter" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "match_lineups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "type" TEXT,
    "title_key" TEXT,
    "message_key" TEXT,
    "message_params" JSONB,
    "old_values" JSONB,
    "new_values" JSONB,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_materialization_logs" (
    "id" TEXT NOT NULL,
    "event_series_id" TEXT NOT NULL,
    "generated_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_materialization_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "type" "ChargeDirection" NOT NULL,
    "code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "parent_id" TEXT,
    "receipt_series" TEXT,

    CONSTRAINT "account_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_charges" (
    "id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category_id" TEXT,
    "reference_type" "AccountReferenceType",
    "reference_id" TEXT,
    "reference_number" TEXT,
    "person_id" TEXT,
    "external_entity" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "account_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_closures" (
    "id" TEXT NOT NULL,
    "financial_account_id" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_balance" DECIMAL(12,2) NOT NULL,
    "actual_balance" DECIMAL(12,2) NOT NULL,
    "difference" DECIMAL(12,2) NOT NULL,
    "observations" TEXT,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "cash_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "third_parties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ThirdPartyType" NOT NULL DEFAULT 'PROVIDER',
    "document_type" TEXT,
    "document_number" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "third_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "internal_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "url" TEXT,
    "path" TEXT,
    "transaction_id" TEXT,
    "uploaded_by_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_season_categories" (
    "id" TEXT NOT NULL,
    "team_season_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "gender" "ProgramGender" NOT NULL,
    "min_birth_year" INTEGER,
    "max_birth_year" INTEGER,
    "min_members" INTEGER,
    "max_members" INTEGER,
    "validate_age" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "ended_at" TIMESTAMP(3),
    "status" "TeamSeasonCategoryStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "team_season_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" TEXT,
    "category" TEXT,
    "tags" TEXT[],
    "author_name" TEXT,
    "status" "NewsStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "category_id" TEXT,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "institution_history_settings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" TEXT,
    "image_alt" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_history_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_history_items" (
    "id" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_history_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "persons_document_number_key" ON "persons"("document_number");

-- CreateIndex
CREATE UNIQUE INDEX "persons_email_key" ON "persons"("email");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_institution_id_name_key" ON "shifts"("institution_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_institution_id_discipline_id_name_key" ON "clubs"("institution_id", "discipline_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_discipline_id_name_key" ON "categories"("discipline_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_institution_id_discipline_id_name_key" ON "seasons"("institution_id", "discipline_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "teams_club_id_name_key" ON "teams"("club_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "team_seasons_team_id_season_id_key" ON "team_seasons"("team_id", "season_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_season_billing_configs_team_season_id_key" ON "team_season_billing_configs"("team_season_id");

-- CreateIndex
CREATE UNIQUE INDEX "players_personId_key" ON "players"("personId");

-- CreateIndex
CREATE INDEX "player_membership_nextRecurringChargeGenerationDate_idx" ON "player_membership"("nextRecurringChargeGenerationDate");

-- CreateIndex
CREATE UNIQUE INDEX "membership_charges_player_membership_id_type_billingMonth_b_key" ON "membership_charges"("player_membership_id", "type", "billingMonth", "billingYear", "billing_cycle");

-- CreateIndex
CREATE UNIQUE INDEX "staff_person_id_key" ON "staff"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "charges_parentChargeId_charge_category_key" ON "charges"("parentChargeId", "charge_category");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receipt_series_receipt_number_key" ON "payments"("receipt_series", "receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reverses_id_key" ON "transactions"("reverses_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_receipt_series_receipt_number_key" ON "transactions"("receipt_series", "receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "internal_transfers_source_transaction_id_key" ON "internal_transfers"("source_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "internal_transfers_destination_transaction_id_key" ON "internal_transfers"("destination_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_sequences_series_key" ON "receipt_sequences"("series");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_person_id_key" ON "users"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "modules_name_key" ON "modules"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "schools_institution_id_discipline_id_name_key" ON "schools"("institution_id", "discipline_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "courses_school_id_name_key" ON "courses"("school_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "course_seasons_course_id_season_id_name_key" ON "course_seasons"("course_id", "season_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "course_season_shifts_course_season_id_shift_id_key" ON "course_season_shifts"("course_season_id", "shift_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_season_shifts_id_course_season_id_key" ON "course_season_shifts"("id", "course_season_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_season_billing_configs_course_season_id_key" ON "course_season_billing_configs"("course_season_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_person_id_key" ON "students"("person_id");

-- CreateIndex
CREATE INDEX "student_memberships_nextRecurringChargeGenerationDate_idx" ON "student_memberships"("nextRecurringChargeGenerationDate");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_enrollments_charge_id_key" ON "cycle_enrollments"("charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_enrollments_student_membership_id_cycle_start_date_cy_key" ON "cycle_enrollments"("student_membership_id", "cycle_start_date", "cycle_end_date");

-- CreateIndex
CREATE UNIQUE INDEX "student_charges_student_membership_id_type_billingMonth_bil_key" ON "student_charges"("student_membership_id", "type", "billingMonth", "billingYear", "billing_cycle");

-- CreateIndex
CREATE INDEX "events_location_id_start_date_end_date_idx" ON "events"("location_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "events_start_date_end_date_idx" ON "events"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "events_event_series_id_idx" ON "events"("event_series_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_event_series_id_original_start_date_key" ON "events"("event_series_id", "original_start_date");

-- CreateIndex
CREATE UNIQUE INDEX "general_events_event_id_key" ON "general_events"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_event_id_key" ON "sessions"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_bookings_charge_id_key" ON "session_bookings"("charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_bookings_session_id_player_id_key" ON "session_bookings"("session_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_bookings_session_id_student_id_key" ON "session_bookings"("session_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_event_id_key" ON "matches"("event_id");

-- CreateIndex
CREATE INDEX "match_call_ups_match_id_side_idx" ON "match_call_ups"("match_id", "side");

-- CreateIndex
CREATE UNIQUE INDEX "match_call_ups_match_id_player_id_key" ON "match_call_ups"("match_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_lineups_call_up_id_key" ON "match_lineups"("call_up_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_categories_code_key" ON "account_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "account_charges_charge_id_key" ON "account_charges"("charge_id");

-- CreateIndex
CREATE INDEX "account_charges_person_id_idx" ON "account_charges"("person_id");

-- CreateIndex
CREATE INDEX "account_charges_category_id_idx" ON "account_charges"("category_id");

-- CreateIndex
CREATE INDEX "cash_closures_financial_account_id_closed_at_idx" ON "cash_closures"("financial_account_id", "closed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_internal_name_key" ON "attachments"("internal_name");

-- CreateIndex
CREATE INDEX "attachments_transaction_id_idx" ON "attachments"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_season_categories_id_team_season_id_key" ON "team_season_categories"("id", "team_season_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_season_categories_team_season_id_category_id_gender_key" ON "team_season_categories"("team_season_id", "category_id", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "news_slug_key" ON "news"("slug");

-- CreateIndex
CREATE INDEX "news_status_idx" ON "news"("status");

-- CreateIndex
CREATE INDEX "news_published_at_idx" ON "news"("published_at");

-- CreateIndex
CREATE INDEX "hero_banners_is_active_idx" ON "hero_banners"("is_active");

-- CreateIndex
CREATE INDEX "hero_banners_sort_order_idx" ON "hero_banners"("sort_order");

-- CreateIndex
CREATE INDEX "home_disciplines_is_active_idx" ON "home_disciplines"("is_active");

-- CreateIndex
CREATE INDEX "home_disciplines_sort_order_idx" ON "home_disciplines"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "news_categories_name_key" ON "news_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "news_categories_slug_key" ON "news_categories"("slug");

-- CreateIndex
CREATE INDEX "promotions_position_idx" ON "promotions"("position");

-- CreateIndex
CREATE INDEX "promotions_position_is_active_idx" ON "promotions"("position", "is_active");

-- CreateIndex
CREATE INDEX "institution_history_items_is_active_idx" ON "institution_history_items"("is_active");

-- CreateIndex
CREATE INDEX "institution_history_items_sort_order_idx" ON "institution_history_items"("sort_order");

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_contacts" ADD CONSTRAINT "person_contacts_contactPersonId_fkey" FOREIGN KEY ("contactPersonId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_contacts" ADD CONSTRAINT "person_contacts_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplines" ADD CONSTRAINT "disciplines_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplines" ADD CONSTRAINT "disciplines_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_contacts" ADD CONSTRAINT "institution_contacts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_contacts" ADD CONSTRAINT "institution_contacts_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_contacts" ADD CONSTRAINT "institution_contacts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_default_account_category_id_fkey" FOREIGN KEY ("default_account_category_id") REFERENCES "account_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_events" ADD CONSTRAINT "season_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_events" ADD CONSTRAINT "season_events_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_events" ADD CONSTRAINT "season_events_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_billing_configs" ADD CONSTRAINT "team_season_billing_configs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_billing_configs" ADD CONSTRAINT "team_season_billing_configs_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_billing_configs" ADD CONSTRAINT "team_season_billing_configs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership" ADD CONSTRAINT "player_membership_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership" ADD CONSTRAINT "player_membership_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership" ADD CONSTRAINT "player_membership_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership" ADD CONSTRAINT "player_membership_teamSeasonCategoryId_team_se_fkey" FOREIGN KEY ("teamSeasonCategoryId", "team_season_id") REFERENCES "team_season_categories"("id", "team_season_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership" ADD CONSTRAINT "player_membership_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership" ADD CONSTRAINT "player_membership_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership_histories" ADD CONSTRAINT "player_membership_histories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership_histories" ADD CONSTRAINT "player_membership_histories_player_membership_id_fkey" FOREIGN KEY ("player_membership_id") REFERENCES "player_membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership_histories" ADD CONSTRAINT "player_membership_histories_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership_pauses" ADD CONSTRAINT "player_membership_pauses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership_pauses" ADD CONSTRAINT "player_membership_pauses_player_membership_id_fkey" FOREIGN KEY ("player_membership_id") REFERENCES "player_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_membership_pauses" ADD CONSTRAINT "player_membership_pauses_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_discounts" ADD CONSTRAINT "membership_discounts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_discounts" ADD CONSTRAINT "membership_discounts_player_membership_id_fkey" FOREIGN KEY ("player_membership_id") REFERENCES "player_membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_discounts" ADD CONSTRAINT "membership_discounts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_charges" ADD CONSTRAINT "membership_charges_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_charges" ADD CONSTRAINT "membership_charges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_charges" ADD CONSTRAINT "membership_charges_player_membership_id_fkey" FOREIGN KEY ("player_membership_id") REFERENCES "player_membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_charges" ADD CONSTRAINT "membership_charges_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_staff" ADD CONSTRAINT "team_season_staff_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_staff" ADD CONSTRAINT "team_season_staff_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_staff" ADD CONSTRAINT "team_season_staff_teamSeasonCategoryId_fkey" FOREIGN KEY ("teamSeasonCategoryId") REFERENCES "team_season_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_staff" ADD CONSTRAINT "team_season_staff_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_parentChargeId_fkey" FOREIGN KEY ("parentChargeId") REFERENCES "charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payer_person_id_fkey" FOREIGN KEY ("payer_person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_third_party_id_fkey" FOREIGN KEY ("third_party_id") REFERENCES "third_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_destination_transaction_id_fkey" FOREIGN KEY ("destination_transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_default_account_category_id_fkey" FOREIGN KEY ("default_account_category_id") REFERENCES "account_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_seasons" ADD CONSTRAINT "course_seasons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_seasons" ADD CONSTRAINT "course_seasons_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_seasons" ADD CONSTRAINT "course_seasons_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_seasons" ADD CONSTRAINT "course_seasons_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_shifts" ADD CONSTRAINT "course_season_shifts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_pauses" ADD CONSTRAINT "team_season_pauses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_pauses" ADD CONSTRAINT "team_season_pauses_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_pauses" ADD CONSTRAINT "team_season_pauses_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_pauses" ADD CONSTRAINT "course_season_pauses_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_pauses" ADD CONSTRAINT "course_season_pauses_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_pauses" ADD CONSTRAINT "course_season_pauses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_pauses" ADD CONSTRAINT "course_season_pauses_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_billing_configs" ADD CONSTRAINT "course_season_billing_configs_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_billing_configs" ADD CONSTRAINT "course_season_billing_configs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_billing_configs" ADD CONSTRAINT "course_season_billing_configs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_staff" ADD CONSTRAINT "course_season_staff_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_staff" ADD CONSTRAINT "course_season_staff_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_staff" ADD CONSTRAINT "course_season_staff_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_season_staff" ADD CONSTRAINT "course_season_staff_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_course_season_shift_id_course_season_i_fkey" FOREIGN KEY ("course_season_shift_id", "course_season_id") REFERENCES "course_season_shifts"("id", "course_season_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_membership_histories" ADD CONSTRAINT "student_membership_histories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_membership_histories" ADD CONSTRAINT "student_membership_histories_student_membership_id_fkey" FOREIGN KEY ("student_membership_id") REFERENCES "student_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_membership_histories" ADD CONSTRAINT "student_membership_histories_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_membership_pauses" ADD CONSTRAINT "student_membership_pauses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_membership_pauses" ADD CONSTRAINT "student_membership_pauses_student_membership_id_fkey" FOREIGN KEY ("student_membership_id") REFERENCES "student_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_membership_pauses" ADD CONSTRAINT "student_membership_pauses_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_course_season_shift_id_course_season_id_fkey" FOREIGN KEY ("course_season_shift_id", "course_season_id") REFERENCES "course_season_shifts"("id", "course_season_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_student_membership_id_fkey" FOREIGN KEY ("student_membership_id") REFERENCES "student_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_student_membership_id_fkey" FOREIGN KEY ("student_membership_id") REFERENCES "student_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_student_membership_id_fkey" FOREIGN KEY ("student_membership_id") REFERENCES "student_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_incidents" ADD CONSTRAINT "session_incidents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_incidents" ADD CONSTRAINT "session_incidents_session_booking_id_fkey" FOREIGN KEY ("session_booking_id") REFERENCES "session_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_incidents" ADD CONSTRAINT "session_incidents_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_evaluations" ADD CONSTRAINT "progress_evaluations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_evaluations" ADD CONSTRAINT "progress_evaluations_evaluator_staff_id_fkey" FOREIGN KEY ("evaluator_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_evaluations" ADD CONSTRAINT "progress_evaluations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_evaluations" ADD CONSTRAINT "progress_evaluations_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_evaluations" ADD CONSTRAINT "progress_evaluations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_evaluations" ADD CONSTRAINT "progress_evaluations_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_event_series_id_fkey" FOREIGN KEY ("event_series_id") REFERENCES "event_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "general_events" ADD CONSTRAINT "general_events_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "general_events" ADD CONSTRAINT "general_events_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "general_events" ADD CONSTRAINT "general_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "general_events" ADD CONSTRAINT "general_events_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "general_events" ADD CONSTRAINT "general_events_teamSeasonCategoryId_fkey" FOREIGN KEY ("teamSeasonCategoryId") REFERENCES "team_season_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_teams" ADD CONSTRAINT "session_teams_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_teams" ADD CONSTRAINT "session_teams_teamSeasonCategoryId_fkey" FOREIGN KEY ("teamSeasonCategoryId") REFERENCES "team_season_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_courses" ADD CONSTRAINT "session_courses_course_season_shift_id_fkey" FOREIGN KEY ("course_season_shift_id") REFERENCES "course_season_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_courses" ADD CONSTRAINT "session_courses_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_bookings" ADD CONSTRAINT "session_bookings_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_bookings" ADD CONSTRAINT "session_bookings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_bookings" ADD CONSTRAINT "session_bookings_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_bookings" ADD CONSTRAINT "session_bookings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_bookings" ADD CONSTRAINT "session_bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_bookings" ADD CONSTRAINT "session_bookings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_season_category_id_fkey" FOREIGN KEY ("team_season_category_id") REFERENCES "team_season_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_season_category_id_fkey" FOREIGN KEY ("home_team_season_category_id") REFERENCES "team_season_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_season_category_id_fkey" FOREIGN KEY ("away_team_season_category_id") REFERENCES "team_season_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_coach_id_fkey" FOREIGN KEY ("home_coach_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_coach_id_fkey" FOREIGN KEY ("away_coach_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_call_ups" ADD CONSTRAINT "match_call_ups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_call_ups" ADD CONSTRAINT "match_call_ups_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_call_ups" ADD CONSTRAINT "match_call_ups_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_call_ups" ADD CONSTRAINT "match_call_ups_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_call_up_id_fkey" FOREIGN KEY ("call_up_id") REFERENCES "match_call_ups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_categories" ADD CONSTRAINT "account_categories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_categories" ADD CONSTRAINT "account_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "account_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_categories" ADD CONSTRAINT "account_categories_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_charges" ADD CONSTRAINT "account_charges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "account_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_charges" ADD CONSTRAINT "account_charges_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_charges" ADD CONSTRAINT "account_charges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_charges" ADD CONSTRAINT "account_charges_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_charges" ADD CONSTRAINT "account_charges_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_categories" ADD CONSTRAINT "team_season_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season_categories" ADD CONSTRAINT "team_season_categories_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "news_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill Settings Singleton
INSERT INTO "institution_history_settings" ("id", "title", "description", "updated_at")
VALUES (
    'institution-history',
    'Nuestra Historia',
    'Casi nueve décadas construyendo identidad, comunidad y excelencia deportiva. Recorré los hitos que nos definen.',
    CURRENT_TIMESTAMP
);

-- Backfill Timeline Items
INSERT INTO "institution_history_items" ("id", "year", "title", "description", "sort_order", "is_active", "updated_at") VALUES 
(gen_random_uuid()::text, '1937', 'Fundación del Club', 'Un grupo de vecinos visionarios funda la institución con la misión de promover el deporte amateur y la vida comunitaria.', 0, true, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, '1958', 'Primer título metropolitano', 'El equipo de vóleibol obtiene el primer campeonato oficial, marcando el inicio de una identidad ganadora.', 1, true, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, '1976', 'Apertura de la sede deportiva', 'Se inaugura el complejo principal con canchas reglamentarias y espacios para la formación de jóvenes atletas.', 2, true, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, '1994', 'Nace la escuela de formación', 'La academia juvenil sistematiza el desarrollo deportivo desde edades tempranas, semillero de futuras estrellas.', 3, true, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, '2011', 'Expansión multideportiva', 'El club incorpora disciplinas como frontón, atletismo y natación, consolidándose como una institución masiva.', 4, true, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, '2026', 'Más de 1.000 atletas activos', 'Hoy somos una de las instituciones polideportivas más grandes de la región, con más de 50 equipos en competición.', 5, true, CURRENT_TIMESTAMP);
