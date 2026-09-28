import { PrismaClient } from './src/generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
  const newsWithImages = await prisma.news.findMany({
    where: {
      content: {
        contains: '<img'
      }
    }
  });

  console.log(`LEGACY EMBEDDED IMAGES FOUND: ${newsWithImages.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
