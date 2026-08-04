import { Injectable, NotFoundException } from '@nestjs/common';

export interface ReportConfig {
  id: string;
  name: string;
  description: string;
  formats: string[];
  filters: string[];
  moduleName: string;
}

export interface ReportHandler {
  generate(params: any, format: string): Promise<any>;
}

@Injectable()
export class ReportRegistry {
  private readonly reports: Map<string, { config: ReportConfig; handler: ReportHandler }> = new Map();

  register(config: ReportConfig, handler: ReportHandler) {
    this.reports.set(config.id, { config, handler });
  }

  getConfigs(): ReportConfig[] {
    return Array.from(this.reports.values()).map(r => r.config);
  }

  getHandler(id: string): ReportHandler {
    const report = this.reports.get(id);
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    return report.handler;
  }
}
