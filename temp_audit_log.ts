import { PrismaClient } from './src/generated/prisma/client';
const prisma = new PrismaClient();

async function run() {
  const charge = await prisma.charge.findFirst({
    where: { chargeCategory: 'LATE_FEE' },
    orderBy: { createdAt: 'asc' }
  });
  console.log('First Late Fee Charge:', charge);
  
  if (charge) {
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: charge.id, entityName: 'Charge' }
    });
    console.log('Audit Logs for this charge:', auditLogs);
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());
