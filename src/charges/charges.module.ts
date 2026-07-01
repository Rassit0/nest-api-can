import { Module } from '@nestjs/common';
import { ChargesService } from './charges.service';
import { ChargesController } from './charges.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [ChargesController],
  providers: [ChargesService, PrismaService],
})
export class ChargesModule {}
