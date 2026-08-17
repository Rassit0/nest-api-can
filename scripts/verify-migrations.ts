import * as dotenv from 'dotenv'; dotenv.config();
import { PrismaClient } from '../src/generated/prisma/client';
const prisma = new PrismaClient();
async function main() {
  const migrations = await prisma.$queryRaw`SELECT migration_name, applied_steps_count FROM _prisma_migrations ORDER BY started_at DESC LIMIT 3`;
  console.log(migrations);
}
main().catch(console.error).finally(() => prisma.$disconnect());
