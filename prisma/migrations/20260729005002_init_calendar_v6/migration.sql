-- 1. Create Enums
CREATE TYPE "EventType" AS ENUM ('SESSION', 'MATCH', 'GENERAL', 'UNAVAILABLE');
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- 2. Create events and general_events tables (without FKs to matches/sessions yet)
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
    "recurrence_rule" TEXT,
    "recurrence_group_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "general_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "institution_id" TEXT,
    "team_season_id" TEXT,
    "course_season_id" TEXT,
    CONSTRAINT "general_events_pkey" PRIMARY KEY ("id")
);

-- 3. Add location hierarchy
ALTER TABLE "locations" ADD COLUMN "max_concurrent_events" INTEGER DEFAULT 1,
ADD COLUMN "parent_id" TEXT;

-- 4. Add event_id to matches and sessions (NULLABLE for now)
ALTER TABLE "matches" ADD COLUMN "event_id" TEXT;
ALTER TABLE "sessions" ADD COLUMN "event_id" TEXT;

-- 5. Data Migration Block (PL/pgSQL)
DO $$ 
DECLARE
  missing_data_count INT;
  rec RECORD;
  new_event_id TEXT;
BEGIN
  -- PRE-VALIDATION
  SELECT COUNT(*) INTO missing_data_count FROM "sessions" WHERE "date_time" IS NULL OR "duration_min" IS NULL OR "duration_min" <= 0;
  IF missing_data_count > 0 THEN
    RAISE EXCEPTION 'Pre-validation failed: % sessions missing date_time or valid duration_min', missing_data_count;
  END IF;

  SELECT COUNT(*) INTO missing_data_count FROM "matches" WHERE "match_date" IS NULL;
  IF missing_data_count > 0 THEN
    RAISE EXCEPTION 'Pre-validation failed: % matches missing match_date', missing_data_count;
  END IF;

  -- MIGRATION: Sessions
  FOR rec IN SELECT * FROM "sessions"
  LOOP
    new_event_id := gen_random_uuid();
    
    INSERT INTO "events" ("id", "title", "start_date", "end_date", "location_id", "event_type", "created_at", "updated_at", "created_by_id", "updated_by_id")
    VALUES (
      new_event_id, 
      rec.title, 
      rec.date_time, 
      rec.date_time + (rec.duration_min || ' minutes')::interval,
      rec.location_id,
      'SESSION',
      rec.created_at,
      rec.updated_at,
      rec.created_by_id,
      rec.updated_by_id
    );

    UPDATE "sessions" SET "event_id" = new_event_id WHERE "id" = rec.id;
  END LOOP;

  -- MIGRATION: Matches
  FOR rec IN SELECT * FROM "matches"
  LOOP
    new_event_id := gen_random_uuid();
    
    -- Assuming match duration is 90 mins if missing from DB context, but events requires end_date
    -- Let's default match duration to 120 minutes (2 hours) for events.
    INSERT INTO "events" ("id", "title", "start_date", "end_date", "location_id", "event_type", "created_at", "updated_at", "created_by_id", "updated_by_id")
    VALUES (
      new_event_id, 
      'Partido ' || COALESCE(rec.opponent_name, ''), 
      rec.match_date, 
      rec.match_date + interval '120 minutes',
      rec.location_id,
      'MATCH',
      rec.created_at,
      rec.updated_at,
      rec.created_by_id,
      rec.updated_by_id
    );

    UPDATE "matches" SET "event_id" = new_event_id WHERE "id" = rec.id;
  END LOOP;

  -- POST-VALIDATION
  SELECT COUNT(*) INTO missing_data_count FROM "sessions" WHERE "event_id" IS NULL;
  IF missing_data_count > 0 THEN
    RAISE EXCEPTION 'Post-validation failed: % sessions were not migrated', missing_data_count;
  END IF;

  SELECT COUNT(*) INTO missing_data_count FROM "matches" WHERE "event_id" IS NULL;
  IF missing_data_count > 0 THEN
    RAISE EXCEPTION 'Post-validation failed: % matches were not migrated', missing_data_count;
  END IF;

END $$;

-- 6. Set event_id to NOT NULL
ALTER TABLE "matches" ALTER COLUMN "event_id" SET NOT NULL;
ALTER TABLE "sessions" ALTER COLUMN "event_id" SET NOT NULL;

-- 7. Drop Old Foreign Keys
ALTER TABLE "matches" DROP CONSTRAINT "matches_created_by_id_fkey";
ALTER TABLE "matches" DROP CONSTRAINT "matches_location_id_fkey";
ALTER TABLE "matches" DROP CONSTRAINT "matches_updated_by_id_fkey";
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_created_by_id_fkey";
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_location_id_fkey";
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_updated_by_id_fkey";

-- Also drop schedules (obsolete)
ALTER TABLE "schedule_courses" DROP CONSTRAINT "schedule_courses_course_season_id_fkey";
ALTER TABLE "schedule_courses" DROP CONSTRAINT "schedule_courses_scheduleId_fkey";
ALTER TABLE "schedule_teams" DROP CONSTRAINT "schedule_teams_scheduleId_fkey";
ALTER TABLE "schedule_teams" DROP CONSTRAINT "schedule_teams_team_season_id_fkey";
ALTER TABLE "schedules" DROP CONSTRAINT "schedules_created_by_id_fkey";
ALTER TABLE "schedules" DROP CONSTRAINT "schedules_location_id_fkey";
ALTER TABLE "schedules" DROP CONSTRAINT "schedules_updated_by_id_fkey";

-- 8. Drop old columns
ALTER TABLE "matches" DROP COLUMN "created_at", DROP COLUMN "created_by_id", DROP COLUMN "location_id", DROP COLUMN "match_date", DROP COLUMN "updated_at", DROP COLUMN "updated_by_id";
ALTER TABLE "sessions" DROP COLUMN "created_at", DROP COLUMN "created_by_id", DROP COLUMN "date_time", DROP COLUMN "location_id", DROP COLUMN "title", DROP COLUMN "updated_at", DROP COLUMN "updated_by_id";

-- 9. Drop Tables and Enums (schedules)
DROP TABLE "schedule_courses";
DROP TABLE "schedule_teams";
DROP TABLE "schedules";
DROP TYPE "DayOfWeek";

-- 10. Create Indexes
CREATE INDEX "events_location_id_start_date_end_date_idx" ON "events"("location_id", "start_date", "end_date");
CREATE INDEX "events_start_date_end_date_idx" ON "events"("start_date", "end_date");
CREATE INDEX "events_recurrence_group_id_idx" ON "events"("recurrence_group_id");
CREATE UNIQUE INDEX "general_events_event_id_key" ON "general_events"("event_id");
CREATE UNIQUE INDEX "matches_event_id_key" ON "matches"("event_id");
CREATE UNIQUE INDEX "sessions_event_id_key" ON "sessions"("event_id");

-- 11. Create New Foreign Keys
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "general_events" ADD CONSTRAINT "general_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "general_events" ADD CONSTRAINT "general_events_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "general_events" ADD CONSTRAINT "general_events_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "general_events" ADD CONSTRAINT "general_events_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
