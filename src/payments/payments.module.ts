import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaService } from 'src/prisma.service';
import { FinancialAccountsModule } from 'src/financial-accounts/financial-accounts.module';

@Module({
  imports: [FinancialAccountsModule],
  providers: [PaymentsService, PrismaService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
