import { PrismaClient } from './src/generated/prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log('=== FASE 3: AUDITORIA READ-ONLY ===\n');

  // 1. Anomalía pendingAmount > amount
  const anomalous = await prisma.charge.findMany({
    where: {
      pendingAmount: { gt: prisma.charge.fields.amount },
    },
    include: {
      membershipCharges: true
    }
  });
  console.log('1. Cargos Anómalos (pending > amount):', anomalous.map(c => ({
    id: c.id, amount: c.amount, pendingAmount: c.pendingAmount, status: c.status, category: c.chargeCategory, createdByCron: c.membershipCharges[0]?.createdByCron, updated: c.updatedAt
  })));

  // 2. LateFees cuyo parent está PENDING vs PARTIAL vs PAID vs CANCELLED
  const lateFees = await prisma.charge.findMany({
    where: { chargeCategory: 'LATE_FEE' },
    select: { parentCharge: { select: { status: true } } }
  });
  const parentStatuses = lateFees.reduce((acc, lf) => {
    const s = lf.parentCharge?.status || 'NO_PARENT';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('\n2. Estados del Charge Padre de los LateFees:', parentStatuses);

  // 3. Distribución de createdAt y updatedAt de LateFees
  const lateFeesDetails = await prisma.charge.findMany({
    where: { chargeCategory: 'LATE_FEE' },
    select: { createdAt: true, updatedAt: true }
  });
  console.log('\n3. Distribución temporal (Ejemplo primeros 5):', lateFeesDetails.slice(0, 5));

}

run().catch(console.error).finally(() => prisma.$disconnect());
