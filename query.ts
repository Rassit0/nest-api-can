import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from './src/generated/prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('Matches:', await prisma.match.count());
  console.log('MatchLineups:', await prisma.matchLineup.count());
  console.log('PlayerMemberships:', await prisma.playerMembership.count());
  console.log('Players:', await prisma.player.count());
  console.log('MatchCallUps:', await prisma.matchCallUp.count());
}
main();
