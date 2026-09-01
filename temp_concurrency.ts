import { PrismaClient, StatusCharge } from './src/generated/prisma/client';
import { lockChargeForUpdate } from './src/common/utils/charge-lock.util';

const prisma = new PrismaClient();

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('--- TEST DE CONCURRENCIA FINANCIERA ---');

  // Crear un cargo temporal para la prueba
  const tempCharge = await prisma.charge.create({
    data: {
      amount: 20,
      pendingAmount: 20,
      status: StatusCharge.PENDING,
      dueDate: new Date(),
    }
  });
  console.log(`Cargo temporal creado ID: ${tempCharge.id}`);

  // Simular proceso Cron que bloquea y luego actualiza
  const runCronMock = async () => {
    return prisma.$transaction(async (tx) => {
      console.log('[Cron] Intentando adquirir lock...');
      const lockedCharge = await lockChargeForUpdate(tx, tempCharge.id);
      console.log(`[Cron] Lock adquirido. PendingActual = ${lockedCharge.pendingAmount}`);
      
      // Simular cálculo lento
      await delay(1000);
      
      const newPending = Number(lockedCharge.pendingAmount) + 5;
      const newAmount = Number(lockedCharge.amount) + 5;
      
      console.log(`[Cron] Actualizando a Pending = ${newPending}`);
      
      await tx.charge.update({
        where: { id: tempCharge.id },
        data: {
          amount: newAmount,
          pendingAmount: newPending,
        }
      });
      console.log('[Cron] Transacción comiteada.');
    });
  };

  // Simular proceso Payment que bloquea y luego actualiza
  const runPaymentMock = async () => {
    // Le damos una ventaja de 100ms al Cron para que gane el lock primero
    await delay(100);
    return prisma.$transaction(async (tx) => {
      console.log('[Payment] Intentando adquirir lock...');
      const lockedCharge = await lockChargeForUpdate(tx, tempCharge.id);
      console.log(`[Payment] Lock adquirido. PendingActual = ${lockedCharge.pendingAmount}`);
      
      const applied = 10;
      const newPending = Number(lockedCharge.pendingAmount) - applied;
      
      console.log(`[Payment] Actualizando a Pending = ${newPending}`);
      
      await tx.charge.update({
        where: { id: tempCharge.id },
        data: {
          pendingAmount: newPending,
        }
      });
      console.log('[Payment] Transacción comiteada.');
    });
  };

  try {
    // Ejecutar simultáneamente
    await Promise.all([runCronMock(), runPaymentMock()]);

    const finalCharge = await prisma.charge.findUnique({ where: { id: tempCharge.id }});
    console.log(`\n=== RESULTADO FINAL ===`);
    console.log(`Amount: ${finalCharge.amount}`);
    console.log(`Pending: ${finalCharge.pendingAmount}`);
    
    // Validaciones
    if (Number(finalCharge.amount) === 25 && Number(finalCharge.pendingAmount) === 15) {
      console.log('✅ TEST SUPERADO: Ambos cálculos se preservaron matemáticamente.');
    } else {
      console.error('❌ TEST FALLIDO: Lost Update detectado.');
    }
  } catch (error) {
    console.error('Error durante la ejecución concurrente:', error);
  } finally {
    // Limpiar el cargo
    await prisma.charge.delete({ where: { id: tempCharge.id } });
    await prisma.$disconnect();
  }
}

run();
