import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [TransactionsService, PrismaService],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
