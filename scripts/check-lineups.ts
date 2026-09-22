import { PrismaClient } from '../src/generated/prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const prisma = new PrismaClient();
  const count = await prisma.matchLineup.count();
  console.log(`MATCH_LINEUPS_COUNT=${count}`);
  await prisma.$disconnect();
}
main();
