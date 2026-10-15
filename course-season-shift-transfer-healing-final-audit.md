# CourseSeason Shift Transfer — Final Data Healing Audit & Validation

- **Audit Date:** 2026-10-14
- **Database Used:** `gestion360_transfer_healing_final_test` (Brand-new isolated local PostgreSQL 16 restoration)
- **Backup Source:** `data_coolify_backups_databases_root-team-0_postgresql-database-us8crlrolbll3lze0f2wwm4h-us8crlrolbll3lze0f2wwm4h_pg-dump-postgres-1791949634.dmp` (8,904,575 bytes, created 2026-10-14 03:47:15 UTC)
- **Production Connection Used:** **NO** (Strictly isolated local restoration)

---

## 1. Business Decision & Root Cause Confirmation

### Business Rule Confirmed
1. **Immediate Transfer Effect:** A shift transfer takes effect immediately when executed.
2. **Active Cycle Movement:** The active `CycleEnrollment` currently in progress must move immediately to the new target shift. It does not wait until the next billing cycle.
3. **Preservation of Concluded Cycles:** Cycles whose `cycleEndDate <= transferDate` are completed historical cycles and must remain in the historical shift.
4. **Identity & Financial Invariance:** The transfer moves the existing `CycleEnrollment` row (`course_season_shift_id`). It does not insert new cycles, nor does it mutate charges or payments.

### Root Cause
In the historical implementation of `transferShift`, if an `overlappingCycle` was found:
```typescript
if (overlappingCycle) {
  transferStartDate = overlappingCycle.cycleEndDate;
}
```
This deferred the cycle transfer to the start of the next cycle, leaving the active cycle stranded in the old shift while `StudentMembership.courseSeasonShiftId` was updated immediately to the new shift. The reason string (e.g. `"a partir del 10/1/2026"` or `"11/1/2026"`) was formatted by Node.js using `en-US` locale on `overlappingCycle.cycleEndDate`.

With the confirmed business rule, the ambiguity is resolved:
- **HEALING_CANDIDATE:** 14
- **LEGITIMATE_HISTORICAL:** 3
- **AMBIGUOUS:** 0

---

## 2. Table of 14 Healing Candidates (Pre-Healing Snapshot)

| # | Student | Membership ID | CycleEnrollment ID | Cycle Dates | Old Shift | Target Shift | Charge ID | Charge Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Daniela Nahir Condori** | `19bcd7ab-04a3-41b6-8da9-e6f2c34d23b6` | `bd012766-48fb-4714-8598-394886d55fb4` | 2026-09-01 to 2026-10-01 | Mañana 10:00 - 11:00 | **Mañana 11:00 - 12:00** | `5ae063d7-c7bf-4be1-b56f-9d5895008644` | PAID (150.00 Bs) |
| 2 | **Genesis Camila Condori** | `46676e7d-9117-4f8b-ba4f-83f2e643d3c4` | `cb42772a-7ee1-4b02-aa93-94ac36a59dda` | 2026-09-01 to 2026-10-01 | Tarde 14:00 - 15:00 | **Tarde 16:00 - 17:00** | `e79d6232-a367-447d-9b48-42ecae831ce6` | PAID (150.00 Bs) |
| 3 | **Valeria Aranza Cruz** | `b675ee02-b5a7-4d13-9519-4b67799b5e78` | `e342906f-cf51-44c4-9269-036f8b612e31` | 2026-09-01 to 2026-10-01 | Tarde 15:00 - 16:00 | **Tarde 14:00 - 15:00** | `a32cdb76-9b87-4d95-9743-15fe5b21e074` | PAID (150.00 Bs) |
| 4 | **Rebeca Clarissa Fernandez** | `302cab48-a55a-4d7c-88d1-2d3981082407` | `2d8c3c7e-a4d8-4d73-863e-0632e5841d00` | 2026-09-01 to 2026-10-01 | Tarde 15:00 - 16:00 | **Tarde 14:00 - 15:00** | `db1ebdfc-b9be-48ee-9b07-98826b16a937` | PAID (150.00 Bs) |
| 5 | **Juan Carlos Flores** | `bf3b742d-c55a-49df-abb7-0b22489a6b08` | `8647fa04-1722-485d-b671-c5234ad08822` | 2026-09-01 to 2026-10-01 | Tarde 14:00 - 15:00 | **Tarde 15:00 - 16:00** | `81996de9-bb12-46cb-8e43-ae30580277e5` | PAID (150.00 Bs) |
| 6 | **Leonado Flores** | `e18389bd-a2bd-4de9-a6cb-b5d127081ed9` | `331cf56b-afe0-40b0-9ea0-39c0cd55827d` | 2026-09-01 to 2026-10-01 | Tarde 15:00 - 16:00 | **Tarde 16:00 - 17:00** | `d85770f2-a32b-448d-9275-16eaad9bae90` | PAID (150.00 Bs) |
| 7 | **Sebastian Luis Gonzales** | `54ea4439-356d-43c9-a61b-2ccab0798054` | `9d3848fd-1f0e-4bfe-bff4-0345784d7934` | 2026-09-01 to 2026-10-01 | Mañana 11:00 - 12:00 | **Tarde 15:00 - 16:00** | `dec4edaa-c874-4330-a24d-ad3426eb7bfd` | PAID (150.00 Bs) |
| 8 | **Iker Marco Medrano** | `b33bee3c-6e41-43fa-8d65-5c808f1f951b` | `e171e7bd-3dc2-484c-9ce4-72008e0b594e` | 2026-09-01 to 2026-10-01 | Mañana 11:00 - 12:00 | **Mañana 10:00 - 11:00** | `d48b0208-f52c-4c80-a652-f97e43cb670f` | PAID (150.00 Bs) |
| 9 | **Adrian Miranda** | `e33c05de-be23-4dbc-a6d9-b81f20efc87c` | `e43daffd-e774-41ba-a3ef-0b9fd1897d41` | 2026-09-01 to 2026-10-01 | Tarde 14:00 - 15:00 | **Tarde 15:00 - 16:00** | `23c744b0-af43-4904-bdba-eccbf4617ebf` | PAID (150.00 Bs) |
| 10 | **Gerson Daniel Mur** | `f4d80b1d-3fa8-45ef-bbfc-079d5e313aa7` | `4796cd82-35d6-4a1b-aa82-d3cbcc4f130e` | 2026-09-01 to 2026-10-01 | Mañana 10:00 - 11:00 | **Mañana 11:00 - 12:00** | `c63b5808-2ccb-4e92-81b4-35243fd99210` | PAID (150.00 Bs) |
| 11 | **Zoe Valentina Choque** | `f673f241-215e-47fe-bfb4-1f39d4675eb0` | `32879c6c-5236-48bf-8528-8962bfb6116d` | 2026-10-01 to 2026-11-01 | Mañana 11:00 - 12:00 | **Mañana 10:00 - 11:00** | `1d6a25fa-2347-4798-ae56-ae896c5256df` | PAID (150.00 Bs) |
| 12 | **Jhon Andree Cruz** | `8a289531-ca37-4bb8-a7d1-33a2fe045cad` | `5bf57306-6a6c-488d-8003-5ec5b9900c31` | 2026-10-01 to 2026-11-01 | Tarde 15:00 - 16:00 | **Tarde 16:00 - 17:00** | `f34fb4eb-1c1e-4d25-8626-7b99b7e578df` | PAID (150.00 Bs) |
| 13 | **Joaquin Arturo Flores ** | `f00405b9-be03-41bc-b4d1-cd86fbb7017d` | `499294fe-952e-45d7-9a52-15251c091d34` | 2026-10-01 to 2026-11-01 | Tarde 17:00 - 18:00 | **Tarde 18:00 - 19:00** | `96cc70fb-4649-4447-ad63-1fcabcd591d2` | PAID (150.00 Bs) |
| 14 | **Santiago Rocha** | `814b4671-ff3f-4809-867a-071a95f6bfb9` | `d566955d-ed63-4902-8d05-e39410c98f0e` | 2026-10-01 to 2026-11-01 | Tarde 14:00 - 15:00 | **Tarde 15:00 - 16:00** | `4055d465-7d8c-47ff-99ce-30d87e3b1b22` | PAID (150.00 Bs) |

---

## 3. Table of 3 Legitimate Historical Records (Untouched)

| # | Student | Membership ID | CycleEnrollment ID | Cycle Dates | Shift (Preserved) | Transfer Date |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Zoe Valentina Choque** | `f673f241-215e-47fe-bfb4-1f39d4675eb0` | `40ba1b07-c963-46c2-848c-18816354ff22` | 2026-09-01 to 2026-10-01 | Mañana 11:00 - 12:00 | 2026-10-12T18:05:23.013Z |
| 2 | **Jhon Andree Cruz** | `8a289531-ca37-4bb8-a7d1-33a2fe045cad` | `b8eb9a4d-656c-4f5b-92bc-ed0020b43359` | 2026-09-01 to 2026-10-01 | Tarde 15:00 - 16:00 | 2026-10-07T23:51:27.829Z |
| 3 | **Santiago Rocha** | `814b4671-ff3f-4809-867a-071a95f6bfb9` | `073d650b-2ace-444b-8fd4-fa145db72144` | 2026-09-01 to 2026-10-01 | Tarde 14:00 - 15:00 | 2026-10-07T23:01:11.722Z |

---

## 4. SQL Scripts Generated

1. **Dry-Run Script:** `course-season-shift-transfer-healing-final-dry-run.sql`
   - Contains pre-flight assertion of 14 candidates.
   - Individual defensive updates checking `ROW_COUNT = 1`.
   - Post-validation of target shift mappings, historical preservation, cycle identity, and financial neutrality.
   - Report query functional simulation.
   - Ends strictly in `ROLLBACK;`.
2. **Production Script:** `course-season-shift-transfer-healing-PRODUCTION.sql`
   - Identical defensive structure with pre-flight check to abort if state drift occurs.
   - Prepared for manual administrator execution.
   - Ends in `COMMIT;`.
