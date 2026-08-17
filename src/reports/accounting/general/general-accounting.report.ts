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
        description: 'Muestra ingresos, egresos, movimientos internos, liquidez y obligaciones por moneda.',
        formats: ['pdf'],
        filters: ['dateRange'],
        moduleName: 'Contabilidad',
      },
      this,
    );
  }

  async generate(params: any, format: string): Promise<any> {
    // 1. Obtener la fuente de verdad preprocesada por el Backend
    const data = await this.analytics.getAccountingSummary(params);

    const { periodStart, periodEnd, treasury, receivables, payables, income, expenses, transfers, periodResultByCurrency } = data;

    // 2. Construcción del PDF
    const builder = new PdfReportBuilder('Reporte General de Contabilidad');

    builder.addCover({
      title: 'Reporte General de Contabilidad',
      subtitle: 'Estados Financieros y Posición de Liquidez',
      dateRange: `${periodStart.toLocaleDateString()} al ${periodEnd.toLocaleDateString()}`,
      generatedBy: params.user || 'Sistema',
      date: new Date().toLocaleDateString(),
    });

    // Encontrar todas las monedas operadas en el periodo (Ingresos, Egresos, Liquidez)
    const activeCurrencies = Array.from(new Set([
      ...Object.keys(income),
      ...Object.keys(expenses),
      ...Object.keys(treasury.liquidityByCurrency),
    ]));

    // --- RESUMEN EJECUTIVO (Separado por moneda) ---
    activeCurrencies.forEach(cur => {
      const inc = income[cur]?.total || 0;
      const exp = expenses[cur]?.total || 0;
      const net = periodResultByCurrency[cur] || 0;
      const liq = treasury.liquidityByCurrency[cur] || 0;
      
      builder.addExecutiveSummary([
        { label: `Ingresos (${cur})`, value: `${inc.toFixed(2)} ${cur}` },
        { label: `Egresos (${cur})`, value: `${exp.toFixed(2)} ${cur}` },
        { label: `Resultado del Período (${cur})`, value: `${net.toFixed(2)} ${cur}` },
        { label: `Liquidez Actual (${cur})`, value: `${liq.toFixed(2)} ${cur}` },
      ]);
    });

    // --- ESTADO DE RESULTADOS ---
    activeCurrencies.forEach(cur => {
      const incData = income[cur];
      const expData = expenses[cur];

      if (!incData && !expData) return;

      const incomeRows = [];
      if (incData) {
        if (incData.school > 0) incomeRows.push(['Ingresos de Escuela (Cursos/Matrículas)', `${incData.school.toFixed(2)}`]);
        if (incData.club > 0) incomeRows.push(['Ingresos de Club (Membresías)', `${incData.club.toFixed(2)}`]);
        
        Object.entries(incData.categories).forEach(([cat, val]) => {
          incomeRows.push([`Ingresos Generales: ${cat}`, `${val.toFixed(2)}`]);
        });

        if (incData.uncategorized > 0) incomeRows.push(['Ingresos Sin Clasificar', `${incData.uncategorized.toFixed(2)}`]);
      }

      if (incomeRows.length > 0) {
        builder.addDataTable({
          title: `Estado de Resultados: Ingresos (${cur})`,
          headers: ['Origen', 'Total'],
          widths: ['*', 'auto'],
          rows: incomeRows,
        });
      }

      const expenseRows = [];
      if (expData) {
        Object.entries(expData.categories).forEach(([cat, val]) => {
          expenseRows.push([cat, `${val.toFixed(2)}`]);
        });
        if (expData.uncategorized > 0) expenseRows.push(['Egresos Sin Clasificar', `${expData.uncategorized.toFixed(2)}`]);
      }

      if (expenseRows.length > 0) {
        builder.addDataTable({
          title: `Estado de Resultados: Egresos (${cur})`,
          headers: ['Categoría', 'Total'],
          widths: ['*', 'auto'],
          rows: expenseRows,
        });
      }
    });

    // --- MOVIMIENTOS INTERNOS ---
    if (transfers.length > 0) {
      builder.addDataTable({
        title: 'Movimientos Internos del Período',
        headers: ['Fecha', 'Origen', 'Destino', 'Monto', 'Moneda'],
        widths: ['auto', '*', '*', 'auto', 'auto'],
        rows: transfers.map(t => [
          new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(t.date)),
          t.sourceAccount,
          t.destinationAccount,
          t.amount.toFixed(2),
          t.currency
        ]),
      });
    }

    // --- POSICION DE LIQUIDEZ ---
    if (treasury.accounts.length > 0) {
      builder.addDataTable({
        title: 'Posición de Liquidez Actual (Por Cuenta)',
        headers: ['Cuenta', 'Tipo', 'Moneda', 'Saldo'],
        widths: ['*', 'auto', 'auto', 'auto'],
        rows: treasury.accounts.map(acc => [
          acc.name,
          acc.type,
          acc.currency,
          acc.balance.toFixed(2)
        ]),
      });
    }

    // --- CUENTAS POR COBRAR Y PAGAR ---
    builder.addDataTable({
      title: 'Cartera y Obligaciones (Cuentas por Cobrar)',
      headers: ['Concepto', 'Vencida (Mora)', 'Vigente'],
      widths: ['*', 'auto', 'auto'],
      rows: [
        ['Escuela / Estudiantes', `${receivables.receivables.expired.student.toFixed(2)}`, `${receivables.receivables.valid.student.toFixed(2)}`],
        ['Club / Membresías', `${receivables.receivables.expired.membership.toFixed(2)}`, `${receivables.receivables.valid.membership.toFixed(2)}`],
        ['Cuentas Generales', `${receivables.receivables.expired.general.toFixed(2)}`, `${receivables.receivables.valid.general.toFixed(2)}`],
        ['TOTAL POR COBRAR', `${receivables.receivables.expired.total.toFixed(2)}`, `${receivables.receivables.valid.total.toFixed(2)}`],
      ],
    });

    builder.addDataTable({
      title: 'Obligaciones (Cuentas por Pagar)',
      headers: ['Concepto', 'Vencida (Mora)', 'Vigente'],
      widths: ['*', 'auto', 'auto'],
      rows: [
        ['Obligaciones a Proveedores / Otros', `${payables.payables.expired.toFixed(2)}`, `${payables.payables.valid.toFixed(2)}`],
      ],
    });

    // --- NOTAS ---
    builder.addNotes('Nota: Las obligaciones actualmente se almacenan como importes sin una moneda explícita en el modelo de base de datos. Por esta razón, este reporte no asigna artificialmente una divisa a las CxC/CxP ni las mezcla con los saldos de liquidez por moneda.');
    builder.addNotes('Nota Adicional: La información de flujos (Ingresos, Egresos y Movimientos Internos) corresponde al período seleccionado. La posición de liquidez representa el estado actual al momento de emisión del reporte.');

    const docDefinition = builder.build();
    return this.printer.createPdf(docDefinition);
  }
}
