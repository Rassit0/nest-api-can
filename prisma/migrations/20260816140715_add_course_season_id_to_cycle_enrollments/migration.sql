-- 1. Agregar columna permitiendo NULL inicialmente
ALTER TABLE "cycle_enrollments" ADD COLUMN "course_season_id" TEXT;

-- 2. Ejecutar el Backfill determinista conservando la integridad de datos
UPDATE "cycle_enrollments" ce
SET "course_season_id" = sm."course_season_id"
FROM "student_memberships" sm
WHERE sm."id" = ce."student_membership_id";

-- 3. Validacion de datos: Abortar la transaccion si queda algun registro con course_season_id NULL
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM "cycle_enrollments" WHERE "course_season_id" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Backfill validation failed: % cycle_enrollments have NULL course_season_id', null_count;
  END IF;
END $$;

-- 4. Imponer la restriccion NOT NULL (Solo pasara si el paso anterior no aborta la transaccion)
ALTER TABLE "cycle_enrollments" ALTER COLUMN "course_season_id" SET NOT NULL;

-- 5. Crear la Foreign Key
ALTER TABLE "cycle_enrollments" ADD CONSTRAINT "cycle_enrollments_course_season_id_fkey" FOREIGN KEY ("course_season_id") REFERENCES "course_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
