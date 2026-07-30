import { Module } from '@nestjs/common';
import { InternalTransfersService } from './internal-transfers.service';
import { InternalTransfersController } from './internal-transfers.controller';
import { PrismaService } from 'src/prisma.service';
import { FinancialAccountsModule } from 'src/financial-accounts/financial-accounts.module';

@Module({
  imports: [FinancialAccountsModule],
  controllers: [InternalTransfersController],
  providers: [InternalTransfersService, PrismaService],
})
export class InternalTransfersModule {}
