import { Injectable, OnModuleInit } from '@nestjs/common';
import { PdfReportBuilder } from '../../core/builders/pdf-report.builder';
import { ReportRegistry, ReportHandler } from '../../core/registry/report.registry';
import { CashClosuresAnalyticsService } from 'src/cash-closures/cash-closures-analytics.service';
import { PrinterService } from 'src/printer/printer.service';

@Injectable()
export class CashClosuresReport implements ReportHandler, OnModuleInit {
  constructor(
    private readonly analytics: CashClosuresAnalyticsService,
    private readonly registry: ReportRegistry,
    private readonly printer: PrinterService,
  ) {}

  onModuleInit() {
    this.registry.register(
      {
        id: 'accounting.cash-closures',
        name: 'Informe de Arqueos de Caja',
        description: 'Muestra el historial y estado de los arqueos de caja agrupados por cuenta física.',
        formats: ['pdf'],
        filters: ['dateRange'],
        moduleName: 'Contabilidad',
      },
      this,
    );
  }

  async generate(params: any, format: string): Promise<any> {
    const today = new Date();
    
    // Configurar fechas
    let periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
    let periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    if (params?.start && params?.end) {
      periodStart = new Date(params.start);
      periodEnd = new Date(params.end);
    }

    // 1. Data Fetching desde el servicio de dominio Analítico (Tesorería)
    const reportData = await this.analytics.getClosuresReportData(periodStart, periodEnd);

    // 2. Data Transformation & PDF Building
    const builder = new PdfReportBuilder('Informe de Arqueos de Caja');

    builder.addCover({
      title: 'Informe de Arqueos de Caja',
      subtitle: 'Auditoría Financiera de Tesorería',
      dateRange: `${periodStart.toLocaleDateString()} al ${periodEnd.toLocaleDateString()}`,
      generatedBy: params.user || 'Sistema',
      date: today.toLocaleDateString(),
    });

    builder.addExecutiveSummary([
      { label: 'Total de Arqueos Realizados', value: `${reportData.summary.totalClosures}` },
      { label: 'Arqueos Cuadrados (Diferencia = 0)', value: `${reportData.summary.exactClosures}` },
      { label: `Arqueos con Sobrante (${reportData.summary.surplusCount})`, value: `+${reportData.summary.surplusAmount.toFixed(2)} Bs.` },
      { label: `Arqueos con Faltante (${reportData.summary.shortageCount})`, value: `-${reportData.summary.shortageAmount.toFixed(2)} Bs.` },
    ]);

    // Dibujar una tabla independiente por cada Caja para facilitar la auditoría administrativa
    for (const group of reportData.groups) {
      if (group.closures.length === 0) continue;

      const rows = group.closures.map(closure => {
        const formattedDate = new Date(closure.closedAt).toLocaleString('es-BO', { 
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        let diffString = '0.00 Bs';
        if (closure.difference > 0) diffString = `+${closure.difference.toFixed(2)} Bs`;
        if (closure.difference < 0) diffString = `${closure.difference.toFixed(2)} Bs`;

        return [
          formattedDate,
          `${closure.createdBy.name} ${closure.createdBy.lastName}`,
          `${closure.expectedBalance.toFixed(2)}`,
          `${closure.actualBalance.toFixed(2)}`,
          `${diffString} [${closure.status}]`,
          closure.observations || 'Sin observaciones'
        ];
      });

      builder.addDataTable({
        title: `Caja: ${group.accountName}`,
        headers: ['Fecha Arqueo', 'Cajero / Responsable', 'Saldo Sist. (Bs)', 'Saldo Real (Bs)', 'Diferencia', 'Observaciones'],
        widths: ['auto', 'auto', 'auto', 'auto', 'auto', '*'],
        rows,
      });
    }

    if (reportData.groups.length === 0) {
      builder.addDataTable({
        title: 'Sin movimientos',
        headers: ['Información'],
        widths: ['*'],
        rows: [['No se registraron arqueos de caja en el periodo seleccionado.']]
      });
    }

    const docDefinition = builder.build();
    return this.printer.createPdf(docDefinition);
  }
}
