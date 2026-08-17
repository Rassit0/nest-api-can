import { PrismaClient } from './src/generated/prisma/client';
const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  
  const transfers = await prisma.internalTransfer.findMany({
    where: {
      date: { gte: periodStart, lte: periodEnd },
      status: 'COMPLETED', // Added to see if we have completed ones
    },
    select: {
      date: true,
      amount: true,
      status: true,
      sourceTransaction: { select: { financialAccount: { select: { name: true, currency: true } } } },
      destinationTransaction: { select: { financialAccount: { select: { name: true } } } },
    },
  });

  console.log('Transfers count in period:', transfers.length);
  if (transfers.length > 0) {
    console.log(transfers);
  }
}

main().finally(() => prisma.$disconnect());
