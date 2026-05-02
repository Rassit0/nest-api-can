/*
  Warnings:

  - Changed the type of `gender` on the `categories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "GenderCategory" AS ENUM ('MALE', 'FEMALE', 'MIXED');

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "gender",
ADD COLUMN     "gender" "GenderCategory" NOT NULL;

-- DropEnum
DROP TYPE "Gender";
