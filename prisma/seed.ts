import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'src/generated/prisma/client';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
async function main() {
  console.log('🌱 Seeding database...');

  const defaultOrganization = await prisma.organization.upsert({
    where: {
      email: 'canoruro@gmail.com',
    },
    update: {},
    create: {
      name: 'Club Atlético Nacional',
      email: 'canoruro@gmail.com',
      address: 'Parque de la Unión',
      phone: '123456789',
    },
  });

  console.log('✅ Organization seeded:', defaultOrganization.name);
}
main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
