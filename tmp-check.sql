SELECT COUNT(*) as sm_count FROM "student_memberships";
SELECT COUNT(*) as ce_count FROM "cycle_enrollments";
SELECT COUNT(*) as charge_count FROM "charges";
SELECT COUNT(*) as pay_count FROM "payments";
SELECT COUNT(*) as smh_count FROM "student_membership_histories";

SELECT status, COUNT(*)
FROM "student_memberships"
GROUP BY status;

SELECT status, COUNT(*)
FROM "cycle_enrollments"
GROUP BY status;

SELECT id, status, notes
FROM "student_memberships"
WHERE status = 'SUSPENDED';

\d "student_memberships"
