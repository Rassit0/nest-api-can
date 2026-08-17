SELECT COUNT(*) as Huerfanos FROM cycle_enrollments ce LEFT JOIN student_memberships sm ON ce.student_membership_id = sm.id WHERE sm.course_season_id IS NULL OR sm.id IS NULL;
