import { Module } from '@nestjs/common';
import { InternalTransfersService } from './internal-transfers.service';
import { InternalTransfersController } from './internal-transfers.controller';
import { PrismaService } from 'src/prisma.service';
import { FinancialAccountsModule } from 'src/financial-accounts/financial-accounts.module';
import { PaymentsModule } from 'src/payments/payments.module';
import { PrinterModule } from 'src/printer/printer.module';

@Module({
  imports: [FinancialAccountsModule, PaymentsModule, PrinterModule],
  controllers: [InternalTransfersController],
  providers: [InternalTransfersService, PrismaService],
  exports: [InternalTransfersService],
})
export class InternalTransfersModule {}
