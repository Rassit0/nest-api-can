import { Controller, Get, Query, Res, BadRequestException, Param, Req, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { ReportRegistry } from './core/registry/report.registry';
import { PaymentsMatrixService } from './payments-matrix.service';
import { PaymentsMatrixPdfService } from './payments-matrix-pdf.service';
import { MonthlyCashflowService } from './monthly-cashflow.service';
import { MonthlyCashflowExcelService } from './monthly-cashflow-excel.service';
import { MonthlyCashflowQueryDto } from './dto/monthly-cashflow.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class ReportsController {
  constructor(
    private readonly registry: ReportRegistry,
    private readonly paymentsMatrixService: PaymentsMatrixService,
    private readonly paymentsMatrixPdfService: PaymentsMatrixPdfService,
    private readonly monthlyCashflowService: MonthlyCashflowService,
    private readonly monthlyCashflowExcelService: MonthlyCashflowExcelService,
  ) {}

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

  @Get('payments-matrix/course-season-shifts/:shiftId')
  @RequirePermissions('READ_COURSE_SEASONS')
  async getCourseSeasonShiftPaymentsMatrix(
    @Param('shiftId') shiftId: string,
    @Req() req: Request & { user: any },
  ) {
    const institutionId = req.user.institutionId;
    return await this.paymentsMatrixService.getCourseSeasonShiftMatrix(institutionId, shiftId);
  }

  @Get('payments-matrix/team-seasons/:teamSeasonId')
  @RequirePermissions('READ_TEAM_SEASONS')
  async getTeamSeasonPaymentsMatrix(
    @Param('teamSeasonId') teamSeasonId: string,
    @Req() req: Request & { user: any },
  ) {
    const institutionId = req.user.institutionId;
    return await this.paymentsMatrixService.getTeamSeasonMatrix(institutionId, teamSeasonId);
  }

  @Get('payments-matrix/course-season-shifts/:shiftId/pdf')
  @RequirePermissions('READ_COURSE_SEASONS')
  async getCourseSeasonShiftPaymentsMatrixPdf(
    @Param('shiftId') shiftId: string,
    @Req() req: Request & { user: any },
    @Res() res: Response,
  ) {
    const institutionId = req.user.institutionId;
    const userName = req.user.name || 'Sistema';
    const result = await this.paymentsMatrixPdfService.generateCourseSeasonShiftPdf(institutionId, shiftId, userName);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=control-pagos-turno-${shiftId}.pdf`,
    );
    result.pipe(res);
    result.end();
  }

  @Get('payments-matrix/team-seasons/:teamSeasonId/pdf')
  @RequirePermissions('READ_TEAM_SEASONS')
  async getTeamSeasonPaymentsMatrixPdf(
    @Param('teamSeasonId') teamSeasonId: string,
    @Req() req: Request & { user: any },
    @Res() res: Response,
  ) {
    const institutionId = req.user.institutionId;
    const userName = req.user.name || 'Sistema';
    const result = await this.paymentsMatrixPdfService.generateTeamSeasonPdf(institutionId, teamSeasonId, userName);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=control-pagos-equipo-${teamSeasonId}.pdf`,
    );
    result.pipe(res);
    result.end();
  }

  @Get('monthly-cashflow')
  @RequirePermissions('READ_REPORTS')
  async getMonthlyCashflow(
    @Query() query: MonthlyCashflowQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.monthlyCashflowService.getCashflowData(query);
    const buffer = await this.monthlyCashflowExcelService.generateExcel(data);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Informe_Flujo_Caja_Mensual_${query.year}_${query.month.toString().padStart(2, '0')}.xlsx`,
    );
    res.send(buffer);
  }
}
