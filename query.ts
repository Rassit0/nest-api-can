import { PrismaClient } from './src/generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.charge.findMany({
    where: {
      description: {
        contains: 'Primer',
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      description: true,
      amount: true,
      status: true
    }
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
