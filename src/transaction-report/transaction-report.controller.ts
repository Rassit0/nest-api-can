import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import { TransactionReportService } from './transaction-report.service';
import { PrinterService } from 'src/printer/printer.service';
import { PrismaService } from 'src/prisma.service';
import { Response } from 'express';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('transaction-report')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class TransactionReportController {
  constructor(
    private readonly transactionReportService: TransactionReportService,
    private readonly printerService: PrinterService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('transaction/:transactionId')
  @RequirePermissions('READ_TRANSACTIONS')
  async getTransactionReport(
    @Res() response: Response,
    @Param('transactionId') transactionId: string,
  ) {
    const pdfDoc =
      await this.transactionReportService.getTransactionByIdReport(
        transactionId,
      );

    // Establece el encabezado de la respuesta para indicar que el contenido es un PDF
    response.setHeader('Content-Type', 'application/pdf');
    pdfDoc.info.Title = 'Transaction-Report';

    // Envía el contenido generado del PDF directamente a la respuesta HTTP
    pdfDoc.pipe(response);

    // Finaliza la generación del PDF y cierra el flujo
    pdfDoc.end();
  }
}
