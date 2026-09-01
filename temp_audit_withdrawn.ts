import { PrismaClient } from './src/generated/prisma/client';
const prisma = new PrismaClient();

async function run() {
  const withdrawnToActive = await prisma.playerMembershipHistory.findMany({
    where: {
      previousStatus: 'WITHDRAWN',
      newStatus: 'ACTIVE'
    }
  });
  console.log('WITHDRAWN -> ACTIVE transitions:', withdrawnToActive.length);
}
run().catch(console.error).finally(() => prisma.$disconnect());
