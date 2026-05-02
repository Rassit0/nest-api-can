import { Module } from '@nestjs/common';
import { PersonsService } from './persons.service';
import { PersonsController } from './persons.controller';
import { PrismaService } from 'src/prisma.service';
import { NestjsFormDataModule } from 'nestjs-form-data';

@Module({
  imports: [NestjsFormDataModule.config({ isGlobal: true })],
  controllers: [PersonsController],
  providers: [PersonsService, PrismaService],
})
export class PersonsModule {}
