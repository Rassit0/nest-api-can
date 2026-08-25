
-- ==========================================
-- TEAMSEASON MULTI-CATEGORY MIGRATION
-- ==========================================

DO $$
DECLARE
    -- Invariants variables
    v_team_season_count INT;
    v_player_membership_count INT;
    v_charge_count INT;
    v_charge_sum DECIMAL;
    v_transaction_count INT;
    v_transaction_sum DECIMAL;
    v_payment_count INT;
    
    v_post_charge_count INT;
    v_post_charge_sum DECIMAL;
    v_post_transaction_count INT;
    v_post_transaction_sum DECIMAL;
    v_post_payment_count INT;
    v_post_category_count INT;
BEGIN
    -- 1. PRE-MIGRATION INVARIANTS
    SELECT COUNT(*) INTO v_team_season_count FROM team_seasons;
    SELECT COUNT(*) INTO v_player_membership_count FROM player_membership;
    SELECT COUNT(*) INTO v_charge_count FROM charges;
    SELECT COALESCE(SUM(amount), 0) INTO v_charge_sum FROM charges;
    SELECT COUNT(*) INTO v_transaction_count FROM transactions;
    SELECT COALESCE(SUM(amount), 0) INTO v_transaction_sum FROM transactions;
    SELECT COUNT(*) INTO v_payment_count FROM payments;

    -- 2. VALIDATE debt_tolerance_months
    IF EXISTS (
        SELECT 1
        FROM team_season_billing_configs
        WHERE debt_tolerance_months NOT IN (1, 2, 3, 8)
    ) THEN
        RAISE EXCEPTION 'BLOCKER: Unrecognized debt_tolerance_months detected in team_season_billing_configs';
    END IF;

    -- 3. CREATE TABLES (Without restrictive NOT NULLs yet)
    CREATE TABLE IF NOT EXISTS "team_season_categories" (
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
        CONSTRAINT "team_season_categories_pkey" PRIMARY KEY ("id")
    );

    ALTER TABLE "general_events" ADD COLUMN IF NOT EXISTS "teamSeasonCategoryId" TEXT;
    ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "teamSeasonCategoryId" TEXT;
    ALTER TABLE "player_membership" ADD COLUMN IF NOT EXISTS "teamSeasonCategoryId" TEXT;
    ALTER TABLE "session_teams" ADD COLUMN IF NOT EXISTS "teamSeasonCategoryId" TEXT;
    ALTER TABLE "team_season_staff" ADD COLUMN IF NOT EXISTS "teamSeasonCategoryId" TEXT;

    -- 4. PARENT MAPPING TABLE (Deterministically chosen)
    CREATE TEMP TABLE tmp_parent_mapping AS
    WITH ranked AS (
        SELECT 
            id as old_id,
            team_id,
            season_id,
            ROW_NUMBER() OVER (
                PARTITION BY team_id, season_id
                ORDER BY created_at ASC, id ASC
            ) as rn
        FROM team_seasons
    )
    SELECT 
        old_id,
        team_id,
        season_id,
        (SELECT old_id FROM ranked r2 WHERE r2.team_id = r1.team_id AND r2.season_id = r1.season_id AND r2.rn = 1) as parent_id
    FROM ranked r1;

    -- 5. CREATE CATEGORIES
    -- Every old TeamSeason becomes one TeamSeasonCategory
    INSERT INTO team_season_categories (
        id,
        team_season_id,
        category_id,
        gender,
        min_birth_year,
        max_birth_year,
        min_members,
        max_members,
        validate_age,
        is_active,
        created_at,
        updated_at,
        created_by_id,
        updated_by_id
    )
    SELECT
        gen_random_uuid()::TEXT,
        m.parent_id, -- Points to the surviving parent
        ts.category_id,
        ts.gender,
        ts.min_birth_year,
        ts.max_birth_year,
        ts.min_members,
        ts.max_members,
        ts.validate_age,
        CASE WHEN ts.status = 'ACTIVE' THEN true ELSE false END,
        ts.created_at,
        ts.updated_at,
        ts.created_by_id,
        ts.updated_by_id
    FROM team_seasons ts
    JOIN tmp_parent_mapping m ON ts.id = m.old_id;

    -- Create mapping for new category IDs
    CREATE TEMP TABLE tmp_cat_mapping AS
    SELECT 
        tsc.id as new_category_id,
        m.old_id as old_team_season_id,
        m.parent_id
    FROM team_season_categories tsc
    JOIN tmp_parent_mapping m ON tsc.team_season_id = m.parent_id
    JOIN team_seasons ts ON ts.id = m.old_id AND ts.category_id = tsc.category_id AND ts.gender = tsc.gender;

    -- 6. UPDATE PARENT STATE (Global Status and isRegistrationOpen)
    UPDATE team_seasons p
    SET 
        status = CASE 
            WHEN EXISTS (
                SELECT 1 FROM team_seasons ts 
                JOIN tmp_parent_mapping m ON ts.id = m.old_id 
                WHERE m.parent_id = p.id AND ts.status = 'ACTIVE'
            ) THEN 'ACTIVE'::"StatusTeamSeason"
            ELSE p.status 
        END,
        is_registration_open = (
            SELECT bool_or(ts.is_registration_open)
            FROM team_seasons ts
            JOIN tmp_parent_mapping m ON ts.id = m.old_id
            WHERE m.parent_id = p.id
        )
    WHERE p.id IN (SELECT DISTINCT parent_id FROM tmp_parent_mapping);

    -- 7. NORMALIZE debt_tolerance_months
    UPDATE team_season_billing_configs
    SET debt_tolerance_months = 2
    WHERE debt_tolerance_months <> 2;

    -- 8. PAYMENT PLANS (Deduplication)
    -- Group plans by signature, and select the oldest as survivor
    CREATE TEMP TABLE tmp_plan_mapping AS
    WITH plan_signature AS (
        SELECT 
            pp.id,
            m.parent_id,
            m.old_id as original_ts_id,
            pp.name,
            pp.registration_discount_percent,
            pp.recurring_discount_percent,
            pp.season_fee_discount_percent,
            pp.is_single_payment,
            ROW_NUMBER() OVER (
                PARTITION BY m.parent_id, pp.name, pp.registration_discount_percent, pp.recurring_discount_percent, pp.season_fee_discount_percent, pp.is_single_payment
                ORDER BY pp.created_at ASC, pp.id ASC
            ) as rn
        FROM payment_plans pp
        JOIN tmp_parent_mapping m ON pp.team_season_id = m.old_id
    )
    SELECT 
        p1.id as old_plan_id,
        p2.id as surviving_plan_id,
        p2.parent_id
    FROM plan_signature p1
    JOIN plan_signature p2 ON 
        p1.parent_id = p2.parent_id AND 
        p1.name = p2.name AND 
        p1.registration_discount_percent = p2.registration_discount_percent AND 
        p1.recurring_discount_percent = p2.recurring_discount_percent AND 
        p1.season_fee_discount_percent = p2.season_fee_discount_percent AND
        p1.is_single_payment = p2.is_single_payment AND
        p2.rn = 1;

    -- Map memberships to surviving plan
    UPDATE player_membership pm
    SET payment_plan_id = tm.surviving_plan_id
    FROM tmp_plan_mapping tm
    WHERE pm.payment_plan_id = tm.old_plan_id;

    -- Reassign surviving plans to the parent team_season
    UPDATE payment_plans pp
    SET team_season_id = tm.parent_id
    FROM tmp_plan_mapping tm
    WHERE pp.id = tm.surviving_plan_id AND pp.team_season_id <> tm.parent_id;

    -- 9. REASSIGN DEPENDENCIES (Match, SessionTeam, Staff, Events, Memberships)
    UPDATE player_membership pm
    SET 
        "teamSeasonCategoryId" = cm.new_category_id,
        team_season_id = cm.parent_id
    FROM tmp_cat_mapping cm
    WHERE pm.team_season_id = cm.old_team_season_id;

    UPDATE matches m
    SET "teamSeasonCategoryId" = cm.new_category_id
    FROM tmp_cat_mapping cm
    WHERE m.team_season_id = cm.old_team_season_id;

    -- Drop primary key before update (handled carefully)
    ALTER TABLE "session_teams" DROP CONSTRAINT IF EXISTS "session_teams_pkey";

    UPDATE session_teams st
    SET "teamSeasonCategoryId" = cm.new_category_id
    FROM tmp_cat_mapping cm
    WHERE st.team_season_id = cm.old_team_season_id;

    UPDATE team_season_staff tss
    SET "teamSeasonCategoryId" = cm.new_category_id
    FROM tmp_cat_mapping cm
    WHERE tss.team_season_id = cm.old_team_season_id;

    UPDATE general_events ge
    SET "teamSeasonCategoryId" = cm.new_category_id
    FROM tmp_cat_mapping cm
    WHERE ge.team_season_id = cm.old_team_season_id;

    -- Validations for PlayerMembership category backfill
    IF EXISTS (
        SELECT 1 FROM player_membership WHERE "teamSeasonCategoryId" IS NULL
    ) THEN
        RAISE EXCEPTION 'BLOCKER: Found player_membership without teamSeasonCategoryId';
    END IF;

    -- 10. ELIMINATION OF CHILDREN & DUPLICATES
    -- First, delete orphan payment plans
    DELETE FROM payment_plans
    WHERE id IN (
        SELECT old_plan_id FROM tmp_plan_mapping 
        WHERE old_plan_id <> surviving_plan_id
    );

    -- Delete duplicate team_season_billing_configs
    DELETE FROM team_season_billing_configs
    WHERE team_season_id IN (
        SELECT old_id FROM tmp_parent_mapping WHERE old_id <> parent_id
    );

    -- Delete duplicate team_season_pauses
    CREATE TEMP TABLE tmp_pause_mapping AS
    WITH pause_sig AS (
        SELECT 
            p.id,
            m.parent_id,
            ROW_NUMBER() OVER (PARTITION BY m.parent_id, p.start_date, p.end_date ORDER BY p.created_at ASC) as rn
        FROM team_season_pauses p
        JOIN tmp_parent_mapping m ON p.team_season_id = m.old_id
    )
    SELECT id, parent_id, rn FROM pause_sig;

    UPDATE team_season_pauses p
    SET team_season_id = tm.parent_id
    FROM tmp_pause_mapping tm
    WHERE p.id = tm.id AND tm.rn = 1 AND p.team_season_id <> tm.parent_id;

    DELETE FROM team_season_pauses
    WHERE id IN (
        SELECT id FROM tmp_pause_mapping WHERE rn > 1
    );

    -- Delete child TeamSeasons (Safe now because all relations point to Parent or Category)
    DELETE FROM team_seasons
    WHERE id IN (
        SELECT old_id FROM tmp_parent_mapping WHERE old_id <> parent_id
    );

    -- Verify no multiple Billing Configs per parent
    IF EXISTS (
        SELECT team_season_id, COUNT(*) 
        FROM team_season_billing_configs 
        GROUP BY team_season_id HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'BLOCKER: Multiple billing configs per TeamSeason found';
    END IF;

    -- 11. APPLY STRICT CONSTRAINTS
    
    -- Drop old foreign keys
    ALTER TABLE "team_seasons" DROP CONSTRAINT IF EXISTS "team_seasons_category_id_fkey";
    
    -- Drop old unique constraints
    DROP INDEX IF EXISTS "team_seasons_team_id_category_id_season_id_gender_status_key";
    DROP INDEX IF EXISTS "team_seasons_team_id_category_id_season_id_gender_key";

    -- Drop legacy columns
    ALTER TABLE "team_seasons" 
        DROP COLUMN IF EXISTS "category_id",
        DROP COLUMN IF EXISTS "gender",
        DROP COLUMN IF EXISTS "max_birth_year",
        DROP COLUMN IF EXISTS "max_members",
        DROP COLUMN IF EXISTS "min_birth_year",
        DROP COLUMN IF EXISTS "min_members",
        DROP COLUMN IF EXISTS "validate_age";

    -- Create new unique constraints
    CREATE UNIQUE INDEX IF NOT EXISTS "team_season_categories_id_team_season_id_key" ON "team_season_categories"("id", "team_season_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "team_season_categories_team_season_id_category_id_gender_key" ON "team_season_categories"("team_season_id", "category_id", "gender");
    CREATE UNIQUE INDEX IF NOT EXISTS "team_seasons_team_id_season_id_key" ON "team_seasons"("team_id", "season_id");

    -- Add back the SessionTeam primary key
    ALTER TABLE "session_teams" ADD CONSTRAINT "session_teams_pkey" PRIMARY KEY ("sessionId", "teamSeasonCategoryId");

    -- Drop the old team_season_id columns from operations since schema drops them
    ALTER TABLE "matches" DROP COLUMN IF EXISTS "team_season_id";
    ALTER TABLE "session_teams" DROP COLUMN IF EXISTS "team_season_id";
    ALTER TABLE "team_season_staff" DROP COLUMN IF EXISTS "team_season_id";
    ALTER TABLE "general_events" DROP COLUMN IF EXISTS "team_season_id";

    -- Make new category ID NOT NULL
    ALTER TABLE "player_membership" ALTER COLUMN "teamSeasonCategoryId" SET NOT NULL;
    ALTER TABLE "matches" ALTER COLUMN "teamSeasonCategoryId" SET NOT NULL;
    ALTER TABLE "session_teams" ALTER COLUMN "teamSeasonCategoryId" SET NOT NULL;
    ALTER TABLE "team_season_staff" ALTER COLUMN "teamSeasonCategoryId" SET NOT NULL;
    
    -- Add Foreign keys
    ALTER TABLE "player_membership" ADD CONSTRAINT "player_membership_teamSeasonCategoryId_team_se_fkey" FOREIGN KEY ("teamSeasonCategoryId", "team_season_id") REFERENCES "team_season_categories"("id", "team_season_id") ON DELETE RESTRICT ON UPDATE CASCADE;
    ALTER TABLE "team_season_staff" ADD CONSTRAINT "team_season_staff_teamSeasonCategoryId_fkey" FOREIGN KEY ("teamSeasonCategoryId") REFERENCES "team_season_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "general_events" ADD CONSTRAINT "general_events_teamSeasonCategoryId_fkey" FOREIGN KEY ("teamSeasonCategoryId") REFERENCES "team_season_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "session_teams" ADD CONSTRAINT "session_teams_teamSeasonCategoryId_fkey" FOREIGN KEY ("teamSeasonCategoryId") REFERENCES "team_season_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "matches" ADD CONSTRAINT "matches_teamSeasonCategoryId_fkey" FOREIGN KEY ("teamSeasonCategoryId") REFERENCES "team_season_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    ALTER TABLE "team_season_categories" ADD CONSTRAINT "team_season_categories_team_season_id_fkey" FOREIGN KEY ("team_season_id") REFERENCES "team_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "team_season_categories" ADD CONSTRAINT "team_season_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

    -- 12. FINAL INVARIANT CHECKS
    SELECT COUNT(*) INTO v_post_category_count FROM team_season_categories;
    IF v_post_category_count <> v_team_season_count THEN
        RAISE EXCEPTION 'BLOCKER: Categories count mismatch. Expected % but got %', v_team_season_count, v_post_category_count;
    END IF;

    SELECT COUNT(*) INTO v_post_charge_count FROM charges;
    SELECT COALESCE(SUM(amount), 0) INTO v_post_charge_sum FROM charges;
    IF v_post_charge_count <> v_charge_count OR v_post_charge_sum <> v_charge_sum THEN
        RAISE EXCEPTION 'BLOCKER: Charges invariant violated';
    END IF;

    SELECT COUNT(*) INTO v_post_transaction_count FROM transactions;
    SELECT COALESCE(SUM(amount), 0) INTO v_post_transaction_sum FROM transactions;
    IF v_post_transaction_count <> v_transaction_count OR v_post_transaction_sum <> v_transaction_sum THEN
        RAISE EXCEPTION 'BLOCKER: Transactions invariant violated';
    END IF;

    SELECT COUNT(*) INTO v_post_payment_count FROM payments;
    IF v_post_payment_count <> v_payment_count THEN
        RAISE EXCEPTION 'BLOCKER: Payments invariant violated';
    END IF;

    -- Validate no orpahns
    IF EXISTS (
        SELECT 1 FROM player_membership pm
        JOIN team_season_categories tsc ON pm."teamSeasonCategoryId" = tsc.id
        WHERE pm.team_season_id <> tsc.team_season_id
    ) THEN
        RAISE EXCEPTION 'BLOCKER: PlayerMembership points to a Category that belongs to a different TeamSeason';
    END IF;

END $$;
