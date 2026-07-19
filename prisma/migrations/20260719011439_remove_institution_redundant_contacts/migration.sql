/*
  Warnings:

  - You are about to drop the column `email` on the `institutions` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `institutions` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "institutions_email_key";

-- AlterTable
ALTER TABLE "institutions" DROP COLUMN "email",
DROP COLUMN "phone";
