import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PrismaService } from 'src/prisma.service';
import { FinancialAccountsModule } from 'src/financial-accounts/financial-accounts.module';

@Module({
  imports: [FinancialAccountsModule],
  providers: [TransactionsService, PrismaService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
