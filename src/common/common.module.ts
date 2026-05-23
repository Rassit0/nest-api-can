import { Global, Module } from '@nestjs/common';
import { ExistsConstraint } from './validators/constraints/exists.constraint';
import { PrismaService } from 'src/prisma.service';

@Global()
@Module({
  providers: [ExistsConstraint, PrismaService],
  exports: [ExistsConstraint],
})
export class CommonModule {}
