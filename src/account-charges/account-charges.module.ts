import { Module } from '@nestjs/common';
import { AccountChargesService } from './account-charges.service';
import { AccountChargesController } from './account-charges.controller';
import { PrismaService } from 'src/prisma.service';
import { ChargesModule } from 'src/charges/charges.module';
import { TransactionsModule } from 'src/transactions/transactions.module';

@Module({
  imports: [ChargesModule, TransactionsModule],
  controllers: [AccountChargesController],
  providers: [AccountChargesService, PrismaService],
})
export class AccountChargesModule {}
