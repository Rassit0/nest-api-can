import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReportRegistry, ReportHandler } from '../../core/registry/report.registry';
import { PdfReportBuilder } from '../../core/builders/pdf-report.builder';
import { AccountingAnalyticsService } from 'src/accounting-analytics/accounting-analytics.service';
import { PrinterService } from 'src/printer/printer.service';

@Injectable()
export class GeneralAccountingReport implements ReportHandler, OnModuleInit {
  constructor(
    private readonly registry: ReportRegistry,
    private readonly analytics: AccountingAnalyticsService,
    private readonly printer: PrinterService,
  ) {}

  onModuleInit() {
    this.registry.register(
      {
        id: 'accounting.general',
        name: 'Reporte General de Contabilidad',
        description: 'Muestra ingresos, egresos, cuentas por cobrar/pagar y liquidez.',
        formats: ['pdf'],
        filters: ['dateRange'],
        moduleName: 'Contabilidad',
      },
      this,
    );
  }

  async generate(params: any, format: string): Promise<any> {
    const { periodStart, periodEnd } = this.analytics.getPeriodDates(params);

    // 1. Data Fetching
    const [financialPosition, totals, transactions] = await Promise.all([
      this.analytics.getGlobalFinancialPosition(),
      this.analytics.getPeriodTotals(periodStart, periodEnd),
      this.analytics.getPeriodTransactions(periodStart, periodEnd),
    ]);

    // Calcular ingresos agrupados conceptualmente (Membresías, Cursos, General)
    let membershipIncome = 0;
    let studentIncome = 0;
    let otherIncome = 0;
    let totalExpenses = 0;

    transactions.forEach((t) => {
      const amt = Number(t.amount);
      if (t.type === 'INCOME') {
        const hasMembership = t.payment?.charge?.membershipCharges?.length > 0;
        const hasStudent = t.payment?.charge?.studentCharges?.length > 0;
        
        if (hasMembership) membershipIncome += amt;
        else if (hasStudent) studentIncome += amt;
        else otherIncome += amt;
      } else if (t.type === 'EXPENSE') {
        totalExpenses += amt;
      }
    });

    // 2. Data Transformation & PDF Building
    const builder = new PdfReportBuilder('Reporte General de Contabilidad');

    builder.addCover({
      title: 'Reporte General de Contabilidad',
      subtitle: 'Resumen Financiero',
      dateRange: `${periodStart.toLocaleDateString()} al ${periodEnd.toLocaleDateString()}`,
      generatedBy: params.user || 'Sistema',
      date: new Date().toLocaleDateString(),
    });

    builder.addExecutiveSummary([
      { label: 'Total Ingresos (Período)', value: `${totals.periodIncome.toFixed(2)} Bs.` },
      { label: 'Total Egresos (Período)', value: `${totals.periodExpenses.toFixed(2)} Bs.` },
      { label: 'Saldo Disponible (Liquidez)', value: `${financialPosition.treasury.availableBalance.toFixed(2)} Bs.` },
      { label: 'Total por Cobrar', value: `${financialPosition.financial.totalReceivables.toFixed(2)} Bs.` },
      { label: 'Total por Pagar', value: `${financialPosition.financial.totalPayables.toFixed(2)} Bs.` },
      { label: 'Posición Neta Proyectada', value: `${financialPosition.financial.netPosition.toFixed(2)} Bs.` },
    ]);

    builder.addDataTable({
      title: 'Estado de Liquidez Actual',
      headers: ['Concepto', 'Monto'],
      widths: ['*', 'auto'],
      rows: [
        ['Efectivo (Cajas)', `${financialPosition.treasury.totalInCash.toFixed(2)} Bs.`],
        ['Bancos y Billeteras', `${financialPosition.treasury.totalInBanks.toFixed(2)} Bs.`],
      ],
    });

    builder.addDataTable({
      title: 'Ingresos del Período',
      headers: ['Origen', 'Total'],
      widths: ['*', 'auto'],
      rows: [
        ['Membresías de Equipos', `${membershipIncome.toFixed(2)} Bs.`],
        ['Mensualidades de Estudiantes', `${studentIncome.toFixed(2)} Bs.`],
        ['Ingresos Generales', `${otherIncome.toFixed(2)} Bs.`],
      ],
    });

    builder.addDataTable({
      title: 'Detalle de Obligaciones y Exigibles',
      headers: ['Concepto', 'Monto'],
      widths: ['*', 'auto'],
      rows: [
        ['Cuentas por Cobrar (Deuda Administrativa)', `${financialPosition.financial.totalAccountReceivables.toFixed(2)} Bs.`],
        ['Cuentas por Cobrar (Membresías Jugadores)', `${financialPosition.financial.totalMembershipReceivables.toFixed(2)} Bs.`],
        ['Cuentas por Pagar (Obligaciones)', `${financialPosition.financial.totalPayables.toFixed(2)} Bs.`],
      ],
    });

    builder.addNotes('Nota: Los saldos de liquidez reflejan el estado actual de las cuentas financieras y no están limitados al rango de fechas consultado. Los ingresos y egresos sí corresponden exclusivamente al rango seleccionado.');

    const docDefinition = builder.build();
    return this.printer.createPdf(docDefinition);
  }
}
