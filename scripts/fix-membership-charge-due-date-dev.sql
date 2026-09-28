-- ============================================================
-- DEVELOPMENT DATABASE ONLY
-- MEMBERSHIP CHARGE TIMEZONE DUE DATE FIX
-- DO NOT RUN IN PRODUCTION
-- ============================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- SECTION A — PREVIEW
-- -----------------------------------------------------------------------------
WITH affected AS (
  SELECT 
    mc.id AS "membershipChargeId",
    c.id AS "chargeId",
    mc."billingYear" AS "billingYear",
    mc."billingMonth" AS "billingMonth",
    tsbc.billing_day AS "billingDay",
    c.due_date AS "actualDueDateUTC",
    c.due_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz' AS "actualDueDateLocal",
    (
      make_date(
        mc."billingYear", 
        mc."billingMonth", 
        LEAST(
          tsbc.billing_day, 
          EXTRACT(DAY FROM (make_date(mc."billingYear", mc."billingMonth", 1) + interval '1 month - 1 day'))::int
        )
      ) + interval '23 hours 59 minutes 59.999 seconds'
    ) AT TIME ZONE 'America/La_Paz' AS "expectedDueDateUTC",
    (
      make_date(
        mc."billingYear", 
        mc."billingMonth", 
        LEAST(
          tsbc.billing_day, 
          EXTRACT(DAY FROM (make_date(mc."billingYear", mc."billingMonth", 1) + interval '1 month - 1 day'))::int
        )
      ) + interval '23 hours 59 minutes 59.999 seconds'
    ) AS "expectedDueDateLocal",
    c.status AS "paymentState"
  FROM membership_charges mc
  JOIN charges c ON c.id = mc.charge_id
  JOIN player_membership pm ON pm.id = mc.player_membership_id
  JOIN team_seasons ts ON ts.id = pm.team_season_id
  JOIN team_season_billing_configs tsbc ON tsbc.team_season_id = ts.id
  WHERE mc.type::text = 'RECURRING_FEE'
    AND mc."billingYear" IS NOT NULL
    AND mc."billingMonth" IS NOT NULL
),
candidates AS (
  SELECT 
    "membershipChargeId",
    "chargeId",
    "billingYear",
    "billingMonth",
    "billingDay",
    "actualDueDateUTC",
    "actualDueDateLocal",
    "expectedDueDateUTC",
    "expectedDueDateLocal",
    ("expectedDueDateUTC" - "actualDueDateUTC") AS "difference",
    "paymentState",
    CASE WHEN ("actualDueDateUTC" = "expectedDueDateUTC" - interval '1 day' AND "paymentState" = 'PENDING') THEN 'YES' ELSE 'NO' END AS "wouldUpdate"
  FROM affected
  WHERE "actualDueDateUTC" = "expectedDueDateUTC" - interval '1 day'
)
SELECT * FROM candidates;

-- -----------------------------------------------------------------------------
-- SECTION B — COUNT GUARD
-- -----------------------------------------------------------------------------
WITH affected AS (
  SELECT 
    c.due_date AS actual_due_date,
    (
      make_date(
        mc."billingYear", 
        mc."billingMonth", 
        LEAST(
          tsbc.billing_day, 
          EXTRACT(DAY FROM (make_date(mc."billingYear", mc."billingMonth", 1) + interval '1 month - 1 day'))::int
        )
      ) + interval '23 hours 59 minutes 59.999 seconds'
    ) AT TIME ZONE 'America/La_Paz' AS expected_due_date,
    c.status AS charge_status
  FROM membership_charges mc
  JOIN charges c ON c.id = mc.charge_id
  JOIN player_membership pm ON pm.id = mc.player_membership_id
  JOIN team_seasons ts ON ts.id = pm.team_season_id
  JOIN team_season_billing_configs tsbc ON tsbc.team_season_id = ts.id
  WHERE mc.type::text = 'RECURRING_FEE'
    AND mc."billingYear" IS NOT NULL
    AND mc."billingMonth" IS NOT NULL
),
candidates AS (
  SELECT *
  FROM affected
  WHERE actual_due_date = expected_due_date - interval '1 day'
    AND charge_status = 'PENDING'
)
SELECT COUNT(*) AS total_update_candidates FROM candidates;


-- -----------------------------------------------------------------------------
-- SECTION C — UPDATE
-- -----------------------------------------------------------------------------
WITH affected AS (
  SELECT 
    c.id AS charge_id,
    c.due_date AS actual_due_date,
    (
      make_date(
        mc."billingYear", 
        mc."billingMonth", 
        LEAST(
          tsbc.billing_day, 
          EXTRACT(DAY FROM (make_date(mc."billingYear", mc."billingMonth", 1) + interval '1 month - 1 day'))::int
        )
      ) + interval '23 hours 59 minutes 59.999 seconds'
    ) AT TIME ZONE 'America/La_Paz' AS expected_due_date
  FROM membership_charges mc
  JOIN charges c ON c.id = mc.charge_id
  JOIN player_membership pm ON pm.id = mc.player_membership_id
  JOIN team_seasons ts ON ts.id = pm.team_season_id
  JOIN team_season_billing_configs tsbc ON tsbc.team_season_id = ts.id
  WHERE mc.type::text = 'RECURRING_FEE'
    AND mc."billingYear" IS NOT NULL
    AND mc."billingMonth" IS NOT NULL
    AND c.status = 'PENDING'
),
candidates AS (
  SELECT charge_id, expected_due_date
  FROM affected a
  JOIN charges c ON c.id = a.charge_id
  WHERE c.due_date = a.expected_due_date - interval '1 day'
)
UPDATE charges c
SET due_date = candidates.expected_due_date
FROM candidates
WHERE c.id = candidates.charge_id
RETURNING c.id AS updated_charge_id, c.due_date AS new_due_date;


-- -----------------------------------------------------------------------------
-- SECTION D — POST CHECK
-- -----------------------------------------------------------------------------
WITH affected AS (
  SELECT 
    c.due_date AS actual_due_date,
    (
      make_date(
        mc."billingYear", 
        mc."billingMonth", 
        LEAST(
          tsbc.billing_day, 
          EXTRACT(DAY FROM (make_date(mc."billingYear", mc."billingMonth", 1) + interval '1 month - 1 day'))::int
        )
      ) + interval '23 hours 59 minutes 59.999 seconds'
    ) AT TIME ZONE 'America/La_Paz' AS expected_due_date,
    c.status AS charge_status
  FROM membership_charges mc
  JOIN charges c ON c.id = mc.charge_id
  JOIN player_membership pm ON pm.id = mc.player_membership_id
  JOIN team_seasons ts ON ts.id = pm.team_season_id
  JOIN team_season_billing_configs tsbc ON tsbc.team_season_id = ts.id
  WHERE mc.type::text = 'RECURRING_FEE'
    AND mc."billingYear" IS NOT NULL
    AND mc."billingMonth" IS NOT NULL
)
SELECT COUNT(*) AS remaining_unpaid_affected
FROM affected
WHERE actual_due_date = expected_due_date - interval '1 day'
  AND charge_status = 'PENDING';

ROLLBACK;

-- PARA APLICAR REALMENTE EN DEV:
-- cambiar únicamente ROLLBACK por COMMIT
