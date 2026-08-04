import { Controller, Get, Query, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { ReportRegistry } from './core/registry/report.registry';

@Controller('reports')
export class ReportsController {
  constructor(private readonly registry: ReportRegistry) {}

  @Get()
  getReports() {
    return { data: this.registry.getConfigs() };
  }

  @Get('download')
  async downloadReport(
    @Query('id') id: string,
    @Query('format') format: string = 'pdf',
    @Query() query: any,
    @Res() res: Response,
  ) {
    if (!id) throw new BadRequestException('Report id is required');

    const handler = this.registry.getHandler(id);
    const result = await handler.generate(query, format);

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${id}-${new Date().getTime()}.pdf`,
      );
      result.pipe(res);
      result.end();
    } else {
      throw new BadRequestException(`Format ${format} not supported yet`);
    }
  }
}
