import { Module } from '@nestjs/common';
import { PlayerPassesService } from './player-passes.service';
import { PlayerPassesController } from './player-passes.controller';
import { PrismaService } from 'src/prisma.service';
import { NestjsFormDataModule } from 'nestjs-form-data';

@Module({
  imports: [NestjsFormDataModule.config({ isGlobal: true })],
  controllers: [PlayerPassesController],
  providers: [PlayerPassesService, PrismaService],
})
export class PlayerPassesModule {}
