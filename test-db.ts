import { config } from 'dotenv';
config();
import { PrismaClient } from './src/generated/prisma/client';
const prisma = new PrismaClient();

async function main() {
  const brokenId = '7a297690-8e7b-4c2b-aff3-0111a8a2f2d9';
  console.log("Checking DB...");
  const rawSMs = await prisma.$queryRaw`SELECT id FROM "student_memberships" WHERE student_id = ${brokenId}`;
  console.log('Raw SMs with broken student_id:', rawSMs);
  
  for (const sm of (rawSMs as any[])) {
    // Delete charges
    await prisma.$executeRaw`DELETE FROM "student_charges" WHERE student_membership_id = ${sm.id}`;
    // Delete pauses
    await prisma.$executeRaw`DELETE FROM "student_membership_pauses" WHERE student_membership_id = ${sm.id}`;
    // Delete histories
    await prisma.$executeRaw`DELETE FROM "student_membership_histories" WHERE student_membership_id = ${sm.id}`;
    // Delete memberships
    await prisma.$executeRaw`DELETE FROM "student_memberships" WHERE id = ${sm.id}`;
  }
  
  console.log('Deleted successfully.');
}
main();
