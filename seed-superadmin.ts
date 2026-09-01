import { PrismaClient } from './src/generated/prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const role = await prisma.role.findFirst({
    where: { name: { contains: 'Super Admin', mode: 'insensitive' } }
  });
  if (!role) {
    const role2 = await prisma.role.findFirst({
      orderBy: { createdAt: 'asc' }
    });
    console.log('No SuperAdmin found, falling back to oldest role:', role2?.name);
    if (role2) {
      await prisma.role.update({
        where: { id: role2.id },
        data: { isSystem: true, isSuperAdmin: true }
      });
      console.log('Updated', role2.name, 'as SuperAdmin');
    }
  } else {
    await prisma.role.update({
      where: { id: role.id },
      data: { isSystem: true, isSuperAdmin: true }
    });
    console.log('Updated', role.name, 'as SuperAdmin');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
