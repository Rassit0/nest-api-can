import { PrismaClient } from './src/generated/prisma/client';
const prisma = new PrismaClient();

async function main() {
  const seasons = await prisma.courseSeason.findMany({
    include: {
      shifts: {
        include: {
          shift: true,
          _count: {
            select: { studentMemberships: true }
          }
        }
      }
    }
  });

  for (const s of seasons) {
    console.log(`CourseSeason: ${s.name} (ID: ${s.id})`);
    for (const sh of s.shifts) {
      console.log(`  Shift: ${sh.shift.name} (ID: ${sh.id}) - Memberships: ${sh._count.studentMemberships}`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
