/*
  Warnings:

  - You are about to drop the column `billing_date` on the `charges` table. All the data in the column will be lost.
  - Added the required column `due_date` to the `charges` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "charges" DROP COLUMN "billing_date",
ADD COLUMN     "due_date" TIMESTAMP(3) NOT NULL;
