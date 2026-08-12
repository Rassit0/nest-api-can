import { PrismaClient } from './generated/prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Fetching transactions...');
  try {
    const count = await prisma.transaction.count();
    console.log('Total:', count);
    
    const tx = await prisma.transaction.findMany({
      orderBy: { transactionDate: 'desc' },
      take: 5
    });
    console.log(JSON.stringify(tx, null, 2));
  } catch(e) {
    console.error(e);
  }
}

main().finally(() => process.exit());
