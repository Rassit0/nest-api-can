-- ============================================================================
-- PRODUCTION DATA HEALING SCRIPT
-- COURSESEASON SHIFT TRANSFER DATA HEALING
-- REQUIRES MANUAL EXECUTION BY SYSTEM ADMINISTRATOR
-- GENERATED FROM PRODUCTION BACKUP AUDIT
-- EXPECTED CANDIDATE ROWS: 14
--
-- CRITICAL SAFETY INSTRUCTIONS:
-- 1. DO NOT EXECUTE IF DATABASE STATE HAS CHANGED SINCE BACKUP AUDIT.
-- 2. THIS SCRIPT INCLUDES PRE-FLIGHT ASSERTIONS THAT WILL AUTOMATICALLY
--    ABORT THE TRANSACTION IF ANY STATE DRIFT OCCURRED.
-- 3. EVERY UPDATE VERIFIES EXACT PRIMARY KEY, FOREIGN KEYS, OLD SHIFT, DATES,
--    AND ASSERTS ROW_COUNT = 1.
-- 4. FINANCIAL TABLES (CHARGES, PAYMENTS) ARE NOT MUTATED.
-- 5. RUN PRE-FLIGHT MANUALLY FIRST IF DESIRED.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  RAISE NOTICE '>>> STARTING PRODUCTION COURSESEASON SHIFT DATA HEALING <<<';
END $$;

-- ----------------------------------------------------------------------------
-- STEP 1: PRE-FLIGHT VERIFICATION ASSERTION
-- Validates that all 14 target rows exist and remain in their expected old shift state.
-- If any row was already modified or deleted, the transaction aborts immediately.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_preflight_count integer;
BEGIN
  SELECT count(*) INTO v_preflight_count
  FROM cycle_enrollments ce
  WHERE (ce.id, ce.student_membership_id, ce.course_season_shift_id, ce.cycle_start_date::date, ce.cycle_end_date::date) IN (
    ('bd012766-48fb-4714-8598-394886d55fb4', '19bcd7ab-04a3-41b6-8da9-e6f2c34d23b6', '021bf8f6-642e-4c4c-8686-333d5829c08f', '2026-09-01'::date, '2026-10-01'::date),
    ('cb42772a-7ee1-4b02-aa93-94ac36a59dda', '46676e7d-9117-4f8b-ba4f-83f2e643d3c4', 'cb3084fb-0596-41e9-a8a2-de0294fe7d74', '2026-09-01'::date, '2026-10-01'::date),
    ('e342906f-cf51-44c4-9269-036f8b612e31', 'b675ee02-b5a7-4d13-9519-4b67799b5e78', '45a88c0d-8f30-4fcd-99c7-5abae463f75c', '2026-09-01'::date, '2026-10-01'::date),
    ('2d8c3c7e-a4d8-4d73-863e-0632e5841d00', '302cab48-a55a-4d7c-88d1-2d3981082407', '45a88c0d-8f30-4fcd-99c7-5abae463f75c', '2026-09-01'::date, '2026-10-01'::date),
    ('8647fa04-1722-485d-b671-c5234ad08822', 'bf3b742d-c55a-49df-abb7-0b22489a6b08', 'cb3084fb-0596-41e9-a8a2-de0294fe7d74', '2026-09-01'::date, '2026-10-01'::date),
    ('331cf56b-afe0-40b0-9ea0-39c0cd55827d', 'e18389bd-a2bd-4de9-a6cb-b5d127081ed9', '45a88c0d-8f30-4fcd-99c7-5abae463f75c', '2026-09-01'::date, '2026-10-01'::date),
    ('9d3848fd-1f0e-4bfe-bff4-0345784d7934', '54ea4439-356d-43c9-a61b-2ccab0798054', '3a60c6e0-2f2c-4b0b-9acf-fe94859840e3', '2026-09-01'::date, '2026-10-01'::date),
    ('e171e7bd-3dc2-484c-9ce4-72008e0b594e', 'b33bee3c-6e41-43fa-8d65-5c808f1f951b', '3a60c6e0-2f2c-4b0b-9acf-fe94859840e3', '2026-09-01'::date, '2026-10-01'::date),
    ('e43daffd-e774-41ba-a3ef-0b9fd1897d41', 'e33c05de-be23-4dbc-a6d9-b81f20efc87c', 'cb3084fb-0596-41e9-a8a2-de0294fe7d74', '2026-09-01'::date, '2026-10-01'::date),
    ('4796cd82-35d6-4a1b-aa82-d3cbcc4f130e', 'f4d80b1d-3fa8-45ef-bbfc-079d5e313aa7', '021bf8f6-642e-4c4c-8686-333d5829c08f', '2026-09-01'::date, '2026-10-01'::date),
    ('32879c6c-5236-48bf-8528-8962bfb6116d', 'f673f241-215e-47fe-bfb4-1f39d4675eb0', '3a60c6e0-2f2c-4b0b-9acf-fe94859840e3', '2026-10-01'::date, '2026-11-01'::date),
    ('5bf57306-6a6c-488d-8003-5ec5b9900c31', '8a289531-ca37-4bb8-a7d1-33a2fe045cad', '45a88c0d-8f30-4fcd-99c7-5abae463f75c', '2026-10-01'::date, '2026-11-01'::date),
    ('499294fe-952e-45d7-9a52-15251c091d34', 'f00405b9-be03-41bc-b4d1-cd86fbb7017d', '25012c00-0696-482e-9d3a-2762662039d8', '2026-10-01'::date, '2026-11-01'::date),
    ('d566955d-ed63-4902-8d05-e39410c98f0e', '814b4671-ff3f-4809-867a-071a95f6bfb9', 'cb3084fb-0596-41e9-a8a2-de0294fe7d74', '2026-10-01'::date, '2026-11-01'::date)
  )
  AND ce.status IN ('CONFIRMED', 'PENDING');

  IF v_preflight_count != 14 THEN
    RAISE EXCEPTION 'PRE-FLIGHT ABORTED: Expected 14 candidate rows matching audit criteria, but found %. Production state has changed since backup! Aborting transaction.', v_preflight_count;
  END IF;

  RAISE NOTICE 'PRE-FLIGHT PASSED: Exactly 14 candidate rows match expected pre-healing state.';
END $$;

-- ----------------------------------------------------------------------------
-- STEP 2: DEFENSIVE CANDIDATE UPDATES (EXACTLY 14 STATEMENTS)
-- ----------------------------------------------------------------------------

-- Candidate 1/14: Daniela Nahir Condori
-- Cycle: 2026-09-01 to 2026-10-01
-- History Event: efb67794-97d8-4064-b4ea-435a3970c8ae (2026-09-02T19:00:28.524Z)
-- Shift Change: "Mañana 10:00 - 11:00" (021bf8f6-642e-4c4c-8686-333d5829c08f) -> "Mañana 11:00 - 12:00" (3a60c6e0-2f2c-4b0b-9acf-fe94859840e3)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = '3a60c6e0-2f2c-4b0b-9acf-fe94859840e3',
    updated_at = NOW()
  WHERE id = 'bd012766-48fb-4714-8598-394886d55fb4'
    AND student_membership_id = '19bcd7ab-04a3-41b6-8da9-e6f2c34d23b6'
    AND course_season_shift_id = '021bf8f6-642e-4c4c-8686-333d5829c08f'
    AND cycle_start_date::date = '2026-09-01'::date
    AND cycle_end_date::date = '2026-10-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 1, 'Daniela Nahir Condori', 'bd012766-48fb-4714-8598-394886d55fb4', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 1, 'Daniela Nahir Condori', 'bd012766-48fb-4714-8598-394886d55fb4';
END $$;

-- Candidate 2/14: Genesis Camila Condori
-- Cycle: 2026-09-01 to 2026-10-01
-- History Event: 82be06d5-dc36-404c-8f60-8ed0375f748d (2026-09-03T02:02:19.935Z)
-- Shift Change: "Tarde 14:00 - 15:00" (cb3084fb-0596-41e9-a8a2-de0294fe7d74) -> "Tarde 16:00 - 17:00" (d3156edc-86bd-4975-95e5-b5b901ab7725)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = 'd3156edc-86bd-4975-95e5-b5b901ab7725',
    updated_at = NOW()
  WHERE id = 'cb42772a-7ee1-4b02-aa93-94ac36a59dda'
    AND student_membership_id = '46676e7d-9117-4f8b-ba4f-83f2e643d3c4'
    AND course_season_shift_id = 'cb3084fb-0596-41e9-a8a2-de0294fe7d74'
    AND cycle_start_date::date = '2026-09-01'::date
    AND cycle_end_date::date = '2026-10-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 2, 'Genesis Camila Condori', 'cb42772a-7ee1-4b02-aa93-94ac36a59dda', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 2, 'Genesis Camila Condori', 'cb42772a-7ee1-4b02-aa93-94ac36a59dda';
END $$;

-- Candidate 3/14: Valeria Aranza Cruz
-- Cycle: 2026-09-01 to 2026-10-01
-- History Event: d2bfcb6f-e97b-4212-832b-1f8bdb1e3319 (2026-09-03T02:00:50.701Z)
-- Shift Change: "Tarde 15:00 - 16:00" (45a88c0d-8f30-4fcd-99c7-5abae463f75c) -> "Tarde 14:00 - 15:00" (cb3084fb-0596-41e9-a8a2-de0294fe7d74)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = 'cb3084fb-0596-41e9-a8a2-de0294fe7d74',
    updated_at = NOW()
  WHERE id = 'e342906f-cf51-44c4-9269-036f8b612e31'
    AND student_membership_id = 'b675ee02-b5a7-4d13-9519-4b67799b5e78'
    AND course_season_shift_id = '45a88c0d-8f30-4fcd-99c7-5abae463f75c'
    AND cycle_start_date::date = '2026-09-01'::date
    AND cycle_end_date::date = '2026-10-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 3, 'Valeria Aranza Cruz', 'e342906f-cf51-44c4-9269-036f8b612e31', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 3, 'Valeria Aranza Cruz', 'e342906f-cf51-44c4-9269-036f8b612e31';
END $$;

-- Candidate 4/14: Rebeca Clarissa Fernandez
-- Cycle: 2026-09-01 to 2026-10-01
-- History Event: d1502afa-056b-4463-9527-1604348de72d (2026-09-05T00:05:47.309Z)
-- Shift Change: "Tarde 15:00 - 16:00" (45a88c0d-8f30-4fcd-99c7-5abae463f75c) -> "Tarde 14:00 - 15:00" (cb3084fb-0596-41e9-a8a2-de0294fe7d74)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = 'cb3084fb-0596-41e9-a8a2-de0294fe7d74',
    updated_at = NOW()
  WHERE id = '2d8c3c7e-a4d8-4d73-863e-0632e5841d00'
    AND student_membership_id = '302cab48-a55a-4d7c-88d1-2d3981082407'
    AND course_season_shift_id = '45a88c0d-8f30-4fcd-99c7-5abae463f75c'
    AND cycle_start_date::date = '2026-09-01'::date
    AND cycle_end_date::date = '2026-10-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 4, 'Rebeca Clarissa Fernandez', '2d8c3c7e-a4d8-4d73-863e-0632e5841d00', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 4, 'Rebeca Clarissa Fernandez', '2d8c3c7e-a4d8-4d73-863e-0632e5841d00';
END $$;

-- Candidate 5/14: Juan Carlos Flores
-- Cycle: 2026-09-01 to 2026-10-01
-- History Event: 99c95445-4e86-4a3c-9cab-b4574fa75072 (2026-09-03T01:46:09.316Z)
-- Shift Change: "Tarde 14:00 - 15:00" (cb3084fb-0596-41e9-a8a2-de0294fe7d74) -> "Tarde 15:00 - 16:00" (45a88c0d-8f30-4fcd-99c7-5abae463f75c)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = '45a88c0d-8f30-4fcd-99c7-5abae463f75c',
    updated_at = NOW()
  WHERE id = '8647fa04-1722-485d-b671-c5234ad08822'
    AND student_membership_id = 'bf3b742d-c55a-49df-abb7-0b22489a6b08'
    AND course_season_shift_id = 'cb3084fb-0596-41e9-a8a2-de0294fe7d74'
    AND cycle_start_date::date = '2026-09-01'::date
    AND cycle_end_date::date = '2026-10-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 5, 'Juan Carlos Flores', '8647fa04-1722-485d-b671-c5234ad08822', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 5, 'Juan Carlos Flores', '8647fa04-1722-485d-b671-c5234ad08822';
END $$;

-- Candidate 6/14: Leonado Flores
-- Cycle: 2026-09-01 to 2026-10-01
-- History Event: e23c54c4-4bba-4d76-bb0b-2f96b25ca8e6 (2026-09-03T02:17:26.288Z)
-- Shift Change: "Tarde 15:00 - 16:00" (45a88c0d-8f30-4fcd-99c7-5abae463f75c) -> "Tarde 16:00 - 17:00" (d3156edc-86bd-4975-95e5-b5b901ab7725)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = 'd3156edc-86bd-4975-95e5-b5b901ab7725',
    updated_at = NOW()
  WHERE id = '331cf56b-afe0-40b0-9ea0-39c0cd55827d'
    AND student_membership_id = 'e18389bd-a2bd-4de9-a6cb-b5d127081ed9'
    AND course_season_shift_id = '45a88c0d-8f30-4fcd-99c7-5abae463f75c'
    AND cycle_start_date::date = '2026-09-01'::date
    AND cycle_end_date::date = '2026-10-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 6, 'Leonado Flores', '331cf56b-afe0-40b0-9ea0-39c0cd55827d', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 6, 'Leonado Flores', '331cf56b-afe0-40b0-9ea0-39c0cd55827d';
END $$;

-- Candidate 7/14: Sebastian Luis Gonzales
-- Cycle: 2026-09-01 to 2026-10-01
-- History Event: 55fc85f6-6358-493d-b203-93e5b78f2dec (2026-09-03T02:09:59.817Z)
-- Shift Change: "Mañana 11:00 - 12:00" (3a60c6e0-2f2c-4b0b-9acf-fe94859840e3) -> "Tarde 15:00 - 16:00" (45a88c0d-8f30-4fcd-99c7-5abae463f75c)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = '45a88c0d-8f30-4fcd-99c7-5abae463f75c',
    updated_at = NOW()
  WHERE id = '9d3848fd-1f0e-4bfe-bff4-0345784d7934'
    AND student_membership_id = '54ea4439-356d-43c9-a61b-2ccab0798054'
    AND course_season_shift_id = '3a60c6e0-2f2c-4b0b-9acf-fe94859840e3'
    AND cycle_start_date::date = '2026-09-01'::date
    AND cycle_end_date::date = '2026-10-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 7, 'Sebastian Luis Gonzales', '9d3848fd-1f0e-4bfe-bff4-0345784d7934', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 7, 'Sebastian Luis Gonzales', '9d3848fd-1f0e-4bfe-bff4-0345784d7934';
END $$;

-- Candidate 8/14: Iker Marco Medrano
-- Cycle: 2026-09-01 to 2026-10-01
-- History Event: 27bf8072-cacf-420b-9cf3-0eb3b32828ef (2026-09-03T00:44:43.418Z)
-- Shift Change: "Mañana 11:00 - 12:00" (3a60c6e0-2f2c-4b0b-9acf-fe94859840e3) -> "Mañana 10:00 - 11:00" (021bf8f6-642e-4c4c-8686-333d5829c08f)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = '021bf8f6-642e-4c4c-8686-333d5829c08f',
    updated_at = NOW()
  WHERE id = 'e171e7bd-3dc2-484c-9ce4-72008e0b594e'
    AND student_membership_id = 'b33bee3c-6e41-43fa-8d65-5c808f1f951b'
    AND course_season_shift_id = '3a60c6e0-2f2c-4b0b-9acf-fe94859840e3'
    AND cycle_start_date::date = '2026-09-01'::date
    AND cycle_end_date::date = '2026-10-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 8, 'Iker Marco Medrano', 'e171e7bd-3dc2-484c-9ce4-72008e0b594e', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 8, 'Iker Marco Medrano', 'e171e7bd-3dc2-484c-9ce4-72008e0b594e';
END $$;

-- Candidate 9/14: Adrian Miranda
-- Cycle: 2026-09-01 to 2026-10-01
-- History Event: e2d49da1-6163-4f69-9ea2-66be12aea053 (2026-09-03T01:52:46.931Z)
-- Shift Change: "Tarde 14:00 - 15:00" (cb3084fb-0596-41e9-a8a2-de0294fe7d74) -> "Tarde 15:00 - 16:00" (45a88c0d-8f30-4fcd-99c7-5abae463f75c)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = '45a88c0d-8f30-4fcd-99c7-5abae463f75c',
    updated_at = NOW()
  WHERE id = 'e43daffd-e774-41ba-a3ef-0b9fd1897d41'
    AND student_membership_id = 'e33c05de-be23-4dbc-a6d9-b81f20efc87c'
    AND course_season_shift_id = 'cb3084fb-0596-41e9-a8a2-de0294fe7d74'
    AND cycle_start_date::date = '2026-09-01'::date
    AND cycle_end_date::date = '2026-10-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 9, 'Adrian Miranda', 'e43daffd-e774-41ba-a3ef-0b9fd1897d41', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 9, 'Adrian Miranda', 'e43daffd-e774-41ba-a3ef-0b9fd1897d41';
END $$;

-- Candidate 10/14: Gerson Daniel Mur
-- Cycle: 2026-09-01 to 2026-10-01
-- History Event: 771acdb3-4005-4430-a133-015322dd25ee (2026-09-02T19:48:38.892Z)
-- Shift Change: "Mañana 10:00 - 11:00" (021bf8f6-642e-4c4c-8686-333d5829c08f) -> "Mañana 11:00 - 12:00" (3a60c6e0-2f2c-4b0b-9acf-fe94859840e3)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = '3a60c6e0-2f2c-4b0b-9acf-fe94859840e3',
    updated_at = NOW()
  WHERE id = '4796cd82-35d6-4a1b-aa82-d3cbcc4f130e'
    AND student_membership_id = 'f4d80b1d-3fa8-45ef-bbfc-079d5e313aa7'
    AND course_season_shift_id = '021bf8f6-642e-4c4c-8686-333d5829c08f'
    AND cycle_start_date::date = '2026-09-01'::date
    AND cycle_end_date::date = '2026-10-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 10, 'Gerson Daniel Mur', '4796cd82-35d6-4a1b-aa82-d3cbcc4f130e', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 10, 'Gerson Daniel Mur', '4796cd82-35d6-4a1b-aa82-d3cbcc4f130e';
END $$;

-- Candidate 11/14: Zoe Valentina Choque
-- Cycle: 2026-10-01 to 2026-11-01
-- History Event: 709d47c2-dd36-40cd-96e3-a3e0e7bef38b (2026-10-12T18:05:23.013Z)
-- Shift Change: "Mañana 11:00 - 12:00" (3a60c6e0-2f2c-4b0b-9acf-fe94859840e3) -> "Mañana 10:00 - 11:00" (021bf8f6-642e-4c4c-8686-333d5829c08f)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = '021bf8f6-642e-4c4c-8686-333d5829c08f',
    updated_at = NOW()
  WHERE id = '32879c6c-5236-48bf-8528-8962bfb6116d'
    AND student_membership_id = 'f673f241-215e-47fe-bfb4-1f39d4675eb0'
    AND course_season_shift_id = '3a60c6e0-2f2c-4b0b-9acf-fe94859840e3'
    AND cycle_start_date::date = '2026-10-01'::date
    AND cycle_end_date::date = '2026-11-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 11, 'Zoe Valentina Choque', '32879c6c-5236-48bf-8528-8962bfb6116d', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 11, 'Zoe Valentina Choque', '32879c6c-5236-48bf-8528-8962bfb6116d';
END $$;

-- Candidate 12/14: Jhon Andree Cruz
-- Cycle: 2026-10-01 to 2026-11-01
-- History Event: 3c122a59-95aa-4d1f-9432-a0a4ed67f2e5 (2026-10-07T23:51:27.829Z)
-- Shift Change: "Tarde 15:00 - 16:00" (45a88c0d-8f30-4fcd-99c7-5abae463f75c) -> "Tarde 16:00 - 17:00" (d3156edc-86bd-4975-95e5-b5b901ab7725)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = 'd3156edc-86bd-4975-95e5-b5b901ab7725',
    updated_at = NOW()
  WHERE id = '5bf57306-6a6c-488d-8003-5ec5b9900c31'
    AND student_membership_id = '8a289531-ca37-4bb8-a7d1-33a2fe045cad'
    AND course_season_shift_id = '45a88c0d-8f30-4fcd-99c7-5abae463f75c'
    AND cycle_start_date::date = '2026-10-01'::date
    AND cycle_end_date::date = '2026-11-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 12, 'Jhon Andree Cruz', '5bf57306-6a6c-488d-8003-5ec5b9900c31', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 12, 'Jhon Andree Cruz', '5bf57306-6a6c-488d-8003-5ec5b9900c31';
END $$;

-- Candidate 13/14: Joaquin Arturo Flores 
-- Cycle: 2026-10-01 to 2026-11-01
-- History Event: c0fc62c2-4925-4b0c-91de-6307ef9c0e16 (2026-10-03T01:35:29.112Z)
-- Shift Change: "Tarde 17:00 - 18:00" (25012c00-0696-482e-9d3a-2762662039d8) -> "Tarde 18:00 - 19:00" (8aede4fe-5cb4-4151-bbdd-75ed6eff64c0)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = '8aede4fe-5cb4-4151-bbdd-75ed6eff64c0',
    updated_at = NOW()
  WHERE id = '499294fe-952e-45d7-9a52-15251c091d34'
    AND student_membership_id = 'f00405b9-be03-41bc-b4d1-cd86fbb7017d'
    AND course_season_shift_id = '25012c00-0696-482e-9d3a-2762662039d8'
    AND cycle_start_date::date = '2026-10-01'::date
    AND cycle_end_date::date = '2026-11-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 13, 'Joaquin Arturo Flores ', '499294fe-952e-45d7-9a52-15251c091d34', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 13, 'Joaquin Arturo Flores ', '499294fe-952e-45d7-9a52-15251c091d34';
END $$;

-- Candidate 14/14: Santiago Rocha
-- Cycle: 2026-10-01 to 2026-11-01
-- History Event: fad8e231-41bb-41f0-a96d-ca3b915c8fd0 (2026-10-07T23:01:11.722Z)
-- Shift Change: "Tarde 14:00 - 15:00" (cb3084fb-0596-41e9-a8a2-de0294fe7d74) -> "Tarde 15:00 - 16:00" (45a88c0d-8f30-4fcd-99c7-5abae463f75c)
DO $$
DECLARE
  v_rows_affected integer;
BEGIN
  UPDATE cycle_enrollments
  SET 
    course_season_shift_id = '45a88c0d-8f30-4fcd-99c7-5abae463f75c',
    updated_at = NOW()
  WHERE id = 'd566955d-ed63-4902-8d05-e39410c98f0e'
    AND student_membership_id = '814b4671-ff3f-4809-867a-071a95f6bfb9'
    AND course_season_shift_id = 'cb3084fb-0596-41e9-a8a2-de0294fe7d74'
    AND cycle_start_date::date = '2026-10-01'::date
    AND cycle_end_date::date = '2026-11-01'::date
    AND status IN ('CONFIRMED', 'PENDING');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected != 1 THEN
    RAISE EXCEPTION 'ASSERTION FAILED on candidate %/14: % (CE: %). Expected 1 row affected, got %. Transaction aborted.', 14, 'Santiago Rocha', 'd566955d-ed63-4902-8d05-e39410c98f0e', v_rows_affected;
  END IF;

  RAISE NOTICE 'Successfully updated Candidate %/14: % (CE: %)', 14, 'Santiago Rocha', 'd566955d-ed63-4902-8d05-e39410c98f0e';
END $$;

-- ----------------------------------------------------------------------------
-- STEP 3: POST-VALIDATION ASSERTIONS
-- ----------------------------------------------------------------------------

-- Assertion 3.1: All 14 candidates now point to their exact target shift
DO $$
DECLARE
  v_target_matches integer;
BEGIN
  SELECT count(*) INTO v_target_matches
  FROM cycle_enrollments ce
  WHERE (ce.id, ce.course_season_shift_id) IN (
    ('bd012766-48fb-4714-8598-394886d55fb4', '3a60c6e0-2f2c-4b0b-9acf-fe94859840e3'),
    ('cb42772a-7ee1-4b02-aa93-94ac36a59dda', 'd3156edc-86bd-4975-95e5-b5b901ab7725'),
    ('e342906f-cf51-44c4-9269-036f8b612e31', 'cb3084fb-0596-41e9-a8a2-de0294fe7d74'),
    ('2d8c3c7e-a4d8-4d73-863e-0632e5841d00', 'cb3084fb-0596-41e9-a8a2-de0294fe7d74'),
    ('8647fa04-1722-485d-b671-c5234ad08822', '45a88c0d-8f30-4fcd-99c7-5abae463f75c'),
    ('331cf56b-afe0-40b0-9ea0-39c0cd55827d', 'd3156edc-86bd-4975-95e5-b5b901ab7725'),
    ('9d3848fd-1f0e-4bfe-bff4-0345784d7934', '45a88c0d-8f30-4fcd-99c7-5abae463f75c'),
    ('e171e7bd-3dc2-484c-9ce4-72008e0b594e', '021bf8f6-642e-4c4c-8686-333d5829c08f'),
    ('e43daffd-e774-41ba-a3ef-0b9fd1897d41', '45a88c0d-8f30-4fcd-99c7-5abae463f75c'),
    ('4796cd82-35d6-4a1b-aa82-d3cbcc4f130e', '3a60c6e0-2f2c-4b0b-9acf-fe94859840e3'),
    ('32879c6c-5236-48bf-8528-8962bfb6116d', '021bf8f6-642e-4c4c-8686-333d5829c08f'),
    ('5bf57306-6a6c-488d-8003-5ec5b9900c31', 'd3156edc-86bd-4975-95e5-b5b901ab7725'),
    ('499294fe-952e-45d7-9a52-15251c091d34', '8aede4fe-5cb4-4151-bbdd-75ed6eff64c0'),
    ('d566955d-ed63-4902-8d05-e39410c98f0e', '45a88c0d-8f30-4fcd-99c7-5abae463f75c')
  );

  IF v_target_matches != 14 THEN
    RAISE EXCEPTION 'POST-VALIDATION ABORTED: Expected 14 rows matching target shifts, got %. Aborting transaction.', v_target_matches;
  END IF;

  RAISE NOTICE 'POST-VALIDATION ASSERTION 3.1 PASSED: 14/14 candidates match target shifts.';
END $$;

-- Assertion 3.2: Historical cycles were NOT modified
DO $$
DECLARE
  v_historical_matches integer;
BEGIN
  SELECT count(*) INTO v_historical_matches
  FROM cycle_enrollments ce
  WHERE (ce.id, ce.course_season_shift_id) IN (
    ('40ba1b07-c963-46c2-848c-18816354ff22', '3a60c6e0-2f2c-4b0b-9acf-fe94859840e3'),
    ('b8eb9a4d-656c-4f5b-92bc-ed0020b43359', '45a88c0d-8f30-4fcd-99c7-5abae463f75c'),
    ('073d650b-2ace-444b-8fd4-fa145db72144', 'cb3084fb-0596-41e9-a8a2-de0294fe7d74')
  );

  IF v_historical_matches != 3 THEN
    RAISE EXCEPTION 'POST-VALIDATION ABORTED: Historical cycle preservation violated! Expected 3, got %. Aborting transaction.', v_historical_matches;
  END IF;

  RAISE NOTICE 'POST-VALIDATION ASSERTION 3.2 PASSED: 3/3 historical cycles remain preserved.';
END $$;

-- Assertion 3.3: Total cycle enrollment count preserved (no phantom rows inserted/deleted)
DO $$
DECLARE
  v_total_cycles integer;
BEGIN
  SELECT count(*) INTO v_total_cycles FROM cycle_enrollments;
  IF v_total_cycles != 489 THEN
    RAISE EXCEPTION 'POST-VALIDATION ABORTED: Total cycle_enrollments count changed! Expected 489, got %. Aborting transaction.', v_total_cycles;
  END IF;

  RAISE NOTICE 'POST-VALIDATION ASSERTION 3.3 PASSED: Total CycleEnrollment count intact (489).';
END $$;

-- Assertion 3.4: Financial neutrality
DO $$
DECLARE
  v_financial_matches integer;
BEGIN
  SELECT count(*) INTO v_financial_matches
  FROM cycle_enrollments ce
  JOIN charges c ON ce.charge_id = c.id
  WHERE (ce.id, c.id, c.amount, c.pending_amount, c.status) IN (
    ('bd012766-48fb-4714-8598-394886d55fb4', '5ae063d7-c7bf-4be1-b56f-9d5895008644', 150.00, 0.00, 'PAID'),
    ('cb42772a-7ee1-4b02-aa93-94ac36a59dda', 'e79d6232-a367-447d-9b48-42ecae831ce6', 150.00, 0.00, 'PAID'),
    ('e342906f-cf51-44c4-9269-036f8b612e31', 'a32cdb76-9b87-4d95-9743-15fe5b21e074', 150.00, 0.00, 'PAID'),
    ('2d8c3c7e-a4d8-4d73-863e-0632e5841d00', 'db1ebdfc-b9be-48ee-9b07-98826b16a937', 150.00, 0.00, 'PAID'),
    ('8647fa04-1722-485d-b671-c5234ad08822', '81996de9-bb12-46cb-8e43-ae30580277e5', 150.00, 0.00, 'PAID'),
    ('331cf56b-afe0-40b0-9ea0-39c0cd55827d', 'd85770f2-a32b-448d-9275-16eaad9bae90', 150.00, 0.00, 'PAID'),
    ('9d3848fd-1f0e-4bfe-bff4-0345784d7934', 'dec4edaa-c874-4330-a24d-ad3426eb7bfd', 150.00, 0.00, 'PAID'),
    ('e171e7bd-3dc2-484c-9ce4-72008e0b594e', 'd48b0208-f52c-4c80-a652-f97e43cb670f', 150.00, 0.00, 'PAID'),
    ('e43daffd-e774-41ba-a3ef-0b9fd1897d41', '23c744b0-af43-4904-bdba-eccbf4617ebf', 150.00, 0.00, 'PAID'),
    ('4796cd82-35d6-4a1b-aa82-d3cbcc4f130e', 'c63b5808-2ccb-4e92-81b4-35243fd99210', 150.00, 0.00, 'PAID'),
    ('32879c6c-5236-48bf-8528-8962bfb6116d', '1d6a25fa-2347-4798-ae56-ae896c5256df', 150.00, 0.00, 'PAID'),
    ('5bf57306-6a6c-488d-8003-5ec5b9900c31', 'f34fb4eb-1c1e-4d25-8626-7b99b7e578df', 150.00, 0.00, 'PAID'),
    ('499294fe-952e-45d7-9a52-15251c091d34', '96cc70fb-4649-4447-ad63-1fcabcd591d2', 150.00, 0.00, 'PAID'),
    ('d566955d-ed63-4902-8d05-e39410c98f0e', '4055d465-7d8c-47ff-99ce-30d87e3b1b22', 150.00, 0.00, 'PAID')
  );

  IF v_financial_matches != 14 THEN
    RAISE EXCEPTION 'POST-VALIDATION ABORTED: Financial data mismatch! Expected 14, got %. Aborting transaction.', v_financial_matches;
  END IF;

  RAISE NOTICE 'POST-VALIDATION ASSERTION 3.4 PASSED: Financial records 100%% untouched.';
END $$;

-- ----------------------------------------------------------------------------
-- STEP 4: FINAL COMMIT
-- ----------------------------------------------------------------------------
COMMIT;
