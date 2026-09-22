  const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const matches = await prisma.match.findMany({
    include: { event: true, homeTeam: true, awayTeam: true }
  });
  console.log(JSON.stringify(matches, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
