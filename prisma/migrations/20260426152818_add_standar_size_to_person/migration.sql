-- CreateEnum
CREATE TYPE "UniformSize" AS ENUM ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL');

-- AlterTable
ALTER TABLE "persons" ADD COLUMN     "standard_size" "UniformSize";
