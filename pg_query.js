const { PrismaClient } = require('./src/generated/prisma/client');
const prisma = new PrismaClient();
async function main() {
  const matches = await prisma.match.count();
  const matchLineups = await prisma.matchLineup.count();
  const playerMemberships = await prisma.playerMembership.count();
  const players = await prisma.player.count();
  const matchCallUps = await prisma.matchCallUp.count();
  console.log(JSON.stringify({matches, matchLineups, playerMemberships, players, matchCallUps}, null, 2));
  await prisma.$disconnect();
}
main();
