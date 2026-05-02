/*
  Warnings:

  - You are about to drop the `teacher_disciplines` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[person_id,discipline_id]` on the table `student_profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[employeeId,discipline_id]` on the table `teacher_profiles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `discipline_id` to the `player_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `player_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `discipline_id` to the `student_profiles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `discipline_id` to the `teacher_profiles` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "teacher_disciplines" DROP CONSTRAINT "teacher_disciplines_discipline_id_fkey";

-- DropForeignKey
ALTER TABLE "teacher_disciplines" DROP CONSTRAINT "teacher_disciplines_teacher_id_fkey";

-- DropIndex
DROP INDEX "student_profiles_person_id_key";

-- DropIndex
DROP INDEX "teacher_profiles_employeeId_key";

-- AlterTable
ALTER TABLE "player_profiles" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "discipline_id" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "discipline_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN     "discipline_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "teacher_disciplines";

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_person_id_discipline_id_key" ON "student_profiles"("person_id", "discipline_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profiles_employeeId_discipline_id_key" ON "teacher_profiles"("employeeId", "discipline_id");

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
