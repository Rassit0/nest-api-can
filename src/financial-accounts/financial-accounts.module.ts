import { Module } from '@nestjs/common';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialAccountsController } from './financial-accounts.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [FinancialAccountsController],
  providers: [FinancialAccountsService, PrismaService],
  exports: [FinancialAccountsService],
})
export class FinancialAccountsModule {}
