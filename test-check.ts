import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const courseSeasonSelect = {
    id: true,
    shifts: {
      select: {
        id: true,
        maxMembers: true,
        _count: {
          select: {
            studentMemberships: {
              where: {
                OR: [
                  { status: 'SUSPENDED' },
                  { status: 'ACTIVE' },
                ],
              },
            },
          },
        },
      },
    },
  };

  const courseSeason = await prisma.courseSeason.findFirst({
    where: { id: "df135ee0-3ce1-4757-ae25-df96f6ec3940" },
    select: courseSeasonSelect,
  });

  console.dir(courseSeason, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
