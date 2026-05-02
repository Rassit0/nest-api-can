/*
  Warnings:

  - You are about to drop the column `tutor_id` on the `persons` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "persons" DROP CONSTRAINT "persons_tutor_id_fkey";

-- AlterTable
ALTER TABLE "persons" DROP COLUMN "tutor_id";

-- CreateTable
CREATE TABLE "tutor_relations" (
    "id" SERIAL NOT NULL,
    "ward_id" INTEGER NOT NULL,
    "tutor_id" INTEGER NOT NULL,
    "relationship" TEXT NOT NULL DEFAULT 'Apoderado',

    CONSTRAINT "tutor_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tutor_relations_ward_id_tutor_id_key" ON "tutor_relations"("ward_id", "tutor_id");

-- AddForeignKey
ALTER TABLE "tutor_relations" ADD CONSTRAINT "tutor_relations_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_relations" ADD CONSTRAINT "tutor_relations_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
