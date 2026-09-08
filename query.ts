import { PrismaClient } from './src/generated/prisma/client';
const prisma = new PrismaClient();
async function main() {
  const id = '0287dbc8-6f74-43d2-982c-3d0b9c9ad282';
  const checks = [
    'paymentPlan', 'discipline', 'teamSeason', 'courseSeason', 'course', 'team',
    'courseSeasonShift', 'person', 'category'
  ];
  for (const check of checks) {
    try {
      const res = await (prisma as any)[check].findUnique({where:{id}});
      if(res) console.log('FOUND IN:', check, res.name || res.title || '');
    } catch(e) {}
  }
}
main().then(()=>prisma.$disconnect());
