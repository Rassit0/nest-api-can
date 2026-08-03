import { Module } from '@nestjs/common';
import { ThirdPartiesService } from './third-parties.service';
import { ThirdPartiesController } from './third-parties.controller';

@Module({
  providers: [ThirdPartiesService],
  controllers: [ThirdPartiesController]
})
export class ThirdPartiesModule {}
