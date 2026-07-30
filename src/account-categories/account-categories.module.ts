import { Module } from '@nestjs/common';
import { AccountCategoriesService } from './account-categories.service';
import { AccountCategoriesController } from './account-categories.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [AccountCategoriesController],
  providers: [AccountCategoriesService, PrismaService],
})
export class AccountCategoriesModule {}
