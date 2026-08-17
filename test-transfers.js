const { PrismaClient } = require('./src/generated/prisma/client/index.js');
const prisma = new PrismaClient();
prisma.internalTransfer.findMany({
  orderBy: { date: 'desc' },
  take: 5
}).then(res => console.log(res)).catch(console.error);
