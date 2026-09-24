import { Module } from '@nestjs/common';
import { PersonsService } from './persons.service';
import { PersonsController } from './persons.controller';
import { PrismaService } from 'src/prisma.service';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [NestjsFormDataModule.config({ isGlobal: true }), StorageModule],
  controllers: [PersonsController],
  providers: [PersonsService, PrismaService],
  exports: [PersonsService],
})
export class PersonsModule {}
