const { PrismaClient } = require('./src/generated/prisma/client'); const prisma = new PrismaClient(); prisma.teamSeason.findFirst({orderBy:{createdAt:'desc'}}).then(console.log).finally(() = 
