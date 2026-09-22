const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const matchesCount = await prisma.match.count();
  console.log('TOTAL MATCHES:', matchesCount);

  const allMatches = await prisma.match.findMany({
    include: {
      teamSeasonCategory: {
        include: {
          teamSeason: true
        }
      }
    }
  });

  let inequvocosHome = 0;
  let inequvocosAway = 0;
  let ambiguos = 0;
  let inconsistentes = 0;

  for (const m of allMatches) {
    const catTeamId = m.teamSeasonCategory.teamSeason.teamId;
    if (m.homeTeamId === catTeamId && m.awayTeamId === catTeamId) {
      ambiguos++;
    } else if (m.homeTeamId === catTeamId) {
      inequvocosHome++;
    } else if (m.awayTeamId === catTeamId) {
      inequvocosAway++;
    } else {
      inconsistentes++;
    }
  }

  console.log({
    total: matchesCount,
    inequvocosHome,
    inequvocosAway,
    ambiguos,
    inconsistentes
  });

}
main().finally(() => prisma.$disconnect());
