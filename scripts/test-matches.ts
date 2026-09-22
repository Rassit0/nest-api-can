import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
  const matches = await prisma.match.findMany({
    include: {
      event: true,
      callUps: true,
      _count: {
        select: {
          callUps: true,
        },
      },
    },
  });
  
  console.log("Total Matches:", matches.length);
  const scheduled = matches.filter(m => m.event.status === 'SCHEDULED').length;
  const completed = matches.filter(m => m.event.status === 'COMPLETED').length;
  console.log("SCHEDULED:", scheduled);
  console.log("COMPLETED:", completed);
  
  matches.forEach(m => {
    console.log(`\nMatch ${m.id}`);
    console.log(`Event Status: ${m.event.status}`);
    console.log(`Score: Home ${m.homeScore} - Away ${m.awayScore}`);
    console.log(`CallUps: ${m._count.callUps}`);
  });
}

main().finally(() => prisma.$disconnect());
