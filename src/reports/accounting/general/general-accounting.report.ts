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
    const [debt, liquidity, totals, transactions] = await Promise.all([
      this.analytics.getDebtMetrics(),
      this.analytics.getLiquidityMetrics(),
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
        const hasMembership = t.chargeTransactions.some(ct => ct.charge.membershipCharges.length > 0);
        const hasStudent = t.chargeTransactions.some(ct => ct.charge.studentCharges.length > 0);
        
        if (hasMembership) membershipIncome += amt;
        else if (hasStudent) studentIncome += amt;
        else otherIncome += amt;
      } else if (t.type === 'EXPENSE') {
        totalExpenses += amt;
      }
    });

    const netPosition = liquidity.totalLiquidity + debt.totalAccountReceivables + debt.totalMembershipReceivables - debt.totalPayables;

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
      { label: 'Liquidez Actual (Cajas+Bancos)', value: `${liquidity.totalLiquidity.toFixed(2)} Bs.` },
      { label: 'Patrimonio Neto Estimado', value: `${netPosition.toFixed(2)} Bs.` },
    ]);

    builder.addDataTable({
      title: 'Estado de Liquidez Actual',
      headers: ['Concepto', 'Monto'],
      widths: ['*', 'auto'],
      rows: [
        ['Efectivo (Cajas)', `${liquidity.totalInCash.toFixed(2)} Bs.`],
        ['Bancos y Billeteras', `${liquidity.totalInBanks.toFixed(2)} Bs.`],
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
      title: 'Deuda Viva (Cuentas por Cobrar y Pagar)',
      headers: ['Concepto', 'Total Pendiente'],
      widths: ['*', 'auto'],
      rows: [
        ['Cuentas por Cobrar (Deuda Administrativa)', `${debt.totalAccountReceivables.toFixed(2)} Bs.`],
        ['Cuentas por Cobrar (Membresías Jugadores)', `${debt.totalMembershipReceivables.toFixed(2)} Bs.`],
        ['Cuentas por Pagar (Obligaciones)', `${debt.totalPayables.toFixed(2)} Bs.`],
      ],
    });

    builder.addNotes('Nota: Los saldos de liquidez reflejan el estado actual de las cuentas financieras y no están limitados al rango de fechas consultado. Los ingresos y egresos sí corresponden exclusivamente al rango seleccionado.');

    const docDefinition = builder.build();
    return this.printer.createPdf(docDefinition);
  }
}
