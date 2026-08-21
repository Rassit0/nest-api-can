const { PrismaClient } = require('./src/generated/prisma/client');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst({
    where: { isActive: true },
    select: { id: true, email: true, institutionId: true, person: { select: { name: true, lastName: true } } }
  });
  console.log('User:', user);
  
  const shift = await prisma.courseSeasonShift.findFirst({
    where: { courseSeason: { course: { school: { institutionId: user.institutionId } } } },
    select: { id: true }
  });
  console.log('Shift:', shift?.id);

  const teamSeason = await prisma.teamSeason.findFirst({
    where: { team: { club: { institutionId: user.institutionId } } },
    select: { id: true }
  });
  console.log('TeamSeason:', teamSeason?.id);
  
  process.exit(0);
}

run().catch(console.error);
