import { PrismaClient, StatusCharge } from './src/generated/prisma/client';
import { lockChargeForUpdate } from './src/common/utils/charge-lock.util';

const prisma = new PrismaClient();

async function run() {
  const charge = await prisma.charge.create({
    data: { amount: 20, pendingAmount: 20, status: StatusCharge.PENDING, dueDate: new Date() }
  });
  
  await prisma.$transaction(async (tx) => {
    const locked = await lockChargeForUpdate(tx, charge.id);
    console.log(locked);
  });
  
  await prisma.charge.delete({ where: { id: charge.id } });
}
run();
