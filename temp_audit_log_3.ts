import { PrismaClient } from './src/generated/prisma/client';
const prisma = new PrismaClient();

async function run() {
  const chargeId = '24c2ad33-32cf-4e49-aea6-05cf56e4fb73';
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityId: chargeId, entityName: 'Charge' },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`Audit Logs for ${chargeId}:`);
  auditLogs.forEach(log => {
    console.log(`Action: ${log.action}, createdAt: ${log.createdAt.toISOString()}`);
    if (log.action === 'UPDATE') {
      console.log(`  old createdById: ${(log.oldValues as any)?.createdById}`);
      console.log(`  new createdById: ${(log.newValues as any)?.createdById}`);
    } else {
      console.log(`  new createdById: ${(log.newValues as any)?.createdById}`);
    }
  });
}
run().catch(console.error).finally(() => prisma.$disconnect());
