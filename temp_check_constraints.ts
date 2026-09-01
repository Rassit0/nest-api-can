import { PrismaClient } from './src/generated/prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('--- AUDITORIA DE CHECK CONSTRAINTS ---');
  
  const invalidNegativePending = await prisma.$queryRaw<any[]>`
    SELECT id, amount, "pending_amount" FROM charges WHERE "pending_amount" < 0
  `;
  console.log(`- pendingAmount < 0: ${invalidNegativePending.length} registros`);

  const invalidPendingGreater = await prisma.$queryRaw<any[]>`
    SELECT id, amount, "pending_amount" FROM charges WHERE "pending_amount" > amount + COALESCE("adjustment_amount", 0)
  `;
  console.log(`- pendingAmount > amount + adjustmentAmount: ${invalidPendingGreater.length} registros`);

  const invalidNegativeAmount = await prisma.$queryRaw<any[]>`
    SELECT id, amount, "pending_amount" FROM charges WHERE amount < 0
  `;
  console.log(`- amount < 0: ${invalidNegativeAmount.length} registros`);

  const invalidStatusPaid = await prisma.$queryRaw<any[]>`
    SELECT id, amount, "pending_amount", status FROM charges WHERE status = 'PAID' AND "pending_amount" > 0
  `;
  console.log(`- status = PAID AND pendingAmount > 0: ${invalidStatusPaid.length} registros`);

  const invalidStatusPending = await prisma.$queryRaw<any[]>`
    SELECT id, amount, "pending_amount", status FROM charges WHERE status = 'PENDING' AND "pending_amount" = 0
  `;
  console.log(`- status = PENDING AND pendingAmount = 0: ${invalidStatusPending.length} registros`);

}

run().catch(console.error).finally(() => prisma.$disconnect());
