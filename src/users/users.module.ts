import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'src/prisma.service';
import { PersonsModule } from '../persons/persons.module';
import { NestjsFormDataModule } from 'nestjs-form-data';

@Module({
  imports: [PersonsModule, NestjsFormDataModule],
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
})
export class UsersModule {}
