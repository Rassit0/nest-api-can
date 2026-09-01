import { PrismaClient } from './src/generated/prisma/client';
const prisma = new PrismaClient();

async function run() {
  const charge = await prisma.charge.findFirst({
    where: { chargeCategory: 'LATE_FEE' },
    orderBy: { createdAt: 'asc' }
  });
  console.log('Charge:', charge);
  if (charge) {
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: charge.id, entityName: 'Charge' },
      orderBy: { createdAt: 'asc' }
    });
    console.log('First Audit Log:', auditLogs[0]);
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());
