/*
  Warnings:

  - You are about to drop the column `employeeId` on the `teacher_profiles` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[register_number,discipline_id]` on the table `player_profiles` will be added. If there are existing duplicate values, this will fail.
  - Made the column `ci` on table `persons` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `grade_level` on the `student_profiles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "teacher_profiles" DROP CONSTRAINT "teacher_profiles_employeeId_fkey";

-- DropIndex
DROP INDEX "teacher_profiles_employeeId_discipline_id_key";

-- AlterTable
ALTER TABLE "persons" ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "phone_emergency" TEXT,
ADD COLUMN     "tutor_id" INTEGER,
ALTER COLUMN "ci" SET NOT NULL;

-- AlterTable
ALTER TABLE "player_profiles" ADD COLUMN     "register_number" TEXT;

-- AlterTable
ALTER TABLE "student_profiles" DROP COLUMN "grade_level",
ADD COLUMN     "grade_level" "GradeLevel" NOT NULL;

-- AlterTable
ALTER TABLE "teacher_profiles" DROP COLUMN "employeeId",
ADD COLUMN     "employeeProfileId" INTEGER,
ADD COLUMN     "personId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "player_profiles_register_number_discipline_id_key" ON "player_profiles"("register_number", "discipline_id");

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "employee_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
