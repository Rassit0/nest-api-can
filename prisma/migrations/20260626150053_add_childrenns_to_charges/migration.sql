-- AlterTable
ALTER TABLE "charges" ADD COLUMN     "parentChargeId" TEXT;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_parentChargeId_fkey" FOREIGN KEY ("parentChargeId") REFERENCES "charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
