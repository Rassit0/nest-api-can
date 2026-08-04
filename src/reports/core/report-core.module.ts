import { Global, Module } from '@nestjs/common';
import { ReportRegistry } from './registry/report.registry';

@Global()
@Module({
  providers: [ReportRegistry],
  exports: [ReportRegistry],
})
export class ReportCoreModule {}
