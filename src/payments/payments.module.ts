import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaService } from 'src/prisma.service';
import { FinancialAccountsModule } from 'src/financial-accounts/financial-accounts.module';
import { ReceiptResolverService } from './receipt-resolver.service';

@Module({
  imports: [FinancialAccountsModule],
  providers: [PaymentsService, PrismaService, ReceiptResolverService],
  controllers: [PaymentsController],
  exports: [PaymentsService, ReceiptResolverService],
})
export class PaymentsModule {}
