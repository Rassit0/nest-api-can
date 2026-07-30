import { PrismaClient } from './src/generated/prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Caja General...');

  // 1. Create or find Caja General
  let cajaGeneral = await prisma.financialAccount.findFirst({
    where: { name: 'Caja General' }
  });

  if (!cajaGeneral) {
    cajaGeneral = await prisma.financialAccount.create({
      data: {
        name: 'Caja General',
        description: 'Cuenta por defecto para transacciones migradas',
        type: 'CASH',
        currency: 'BOB',
        isActive: true,
        initialBalance: 0,
        cachedBalance: 0,
      }
    });
    console.log('Created Caja General:', cajaGeneral.id);
  } else {
    console.log('Caja General already exists:', cajaGeneral.id);
  }

  // 2. Attach to existing transactions
  const result = await prisma.transaction.updateMany({
    where: {
      financialAccountId: null
    },
    data: {
      financialAccountId: cajaGeneral.id
    }
  });

  console.log(`Updated ${result.count} transactions to use Caja General.`);

  // 3. Recalculate balance for Caja General
  const aggregations = await prisma.transaction.groupBy({
    by: ['type'],
    where: {
      financialAccountId: cajaGeneral.id,
      status: 'COMPLETED',
    },
    _sum: {
      amount: true,
    },
  });

  let totalIncome = 0;
  let totalExpense = 0;

  for (const agg of aggregations) {
    if (agg.type === 'INCOME') {
      totalIncome = agg._sum.amount?.toNumber() || 0;
    } else if (agg.type === 'EXPENSE') {
      totalExpense = agg._sum.amount?.toNumber() || 0;
    }
  }

  const newBalance = Number(cajaGeneral.initialBalance) + totalIncome - totalExpense;

  await prisma.financialAccount.update({
    where: { id: cajaGeneral.id },
    data: { cachedBalance: newBalance },
  });

  console.log(`Caja General balance recalculated: ${newBalance}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
