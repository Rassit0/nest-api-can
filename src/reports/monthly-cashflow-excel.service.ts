import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { MonthlyCashflowData } from './monthly-cashflow.service';

@Injectable()
export class MonthlyCashflowExcelService {
  async generateExcel(data: MonthlyCashflowData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema Gestión CAN';
    workbook.lastModifiedBy = 'Sistema Gestión CAN';
    workbook.created = new Date();
    workbook.modified = new Date();

    this.createSummarySheet(workbook, data);
    this.createDetailsSheet(workbook, data);
    this.createInternalTransfersSheet(workbook, data);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private createSummarySheet(workbook: ExcelJS.Workbook, data: MonthlyCashflowData) {
    const sheet = workbook.addWorksheet('Resumen Mensual', {
      views: [{ state: 'frozen', ySplit: 4, xSplit: 1 }]
    });

    // --- ESTILOS COMUNES ---
    const headerFill = <ExcelJS.Fill>{ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    const headerFont: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true };
    const subheaderFill = <ExcelJS.Fill>{ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
    const moneyFormat = '"Bs" #,##0.00;[Red]-"Bs" #,##0.00';

    // --- FILA 1: TÍTULO ---
    const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const title = `INFORME MENSUAL DE FLUJO DE CAJA - ${monthNames[data.month - 1]} ${data.year}`;
    sheet.getCell('A1').value = title;
    sheet.getCell('A1').font = { size: 14, bold: true };
    sheet.mergeCells('A1:E1');

    // --- FILA 2 & 3: ENCABEZADOS AGRUPADOS ---
    // Calculamos el número de columnas de ingresos y egresos
    const numIncomes = data.columns.incomes.length;
    const numExpenses = data.columns.expenses.length;

    // Fila 2
    const row2 = sheet.getRow(2);
    row2.getCell(1).value = 'FECHA';
    row2.getCell(1).fill = headerFill;
    row2.getCell(1).font = headerFont;

    let currentCol = 2;

    // INGRESOS
    if (numIncomes > 0) {
      row2.getCell(currentCol).value = 'INGRESOS';
      row2.getCell(currentCol).fill = headerFill;
      row2.getCell(currentCol).font = headerFont;
      row2.getCell(currentCol).alignment = { horizontal: 'center' };
      if (numIncomes > 1) {
        sheet.mergeCells(2, currentCol, 2, currentCol + numIncomes - 1);
      }
      currentCol += numIncomes;
    }

    row2.getCell(currentCol).value = 'TOTAL INGRESOS';
    row2.getCell(currentCol).fill = headerFill;
    row2.getCell(currentCol).font = headerFont;
    const totalIncomeCol = currentCol;
    currentCol++;

    // EGRESOS
    if (numExpenses > 0) {
      row2.getCell(currentCol).value = 'EGRESOS';
      row2.getCell(currentCol).fill = headerFill;
      row2.getCell(currentCol).font = headerFont;
      row2.getCell(currentCol).alignment = { horizontal: 'center' };
      if (numExpenses > 1) {
        sheet.mergeCells(2, currentCol, 2, currentCol + numExpenses - 1);
      }
      currentCol += numExpenses;
    }

    row2.getCell(currentCol).value = 'TOTAL EGRESOS';
    row2.getCell(currentCol).fill = headerFill;
    row2.getCell(currentCol).font = headerFont;
    const totalExpenseCol = currentCol;
    currentCol++;

    // TOTALES
    row2.getCell(currentCol).value = 'FLUJO NETO';
    row2.getCell(currentCol).fill = headerFill;
    row2.getCell(currentCol).font = headerFont;
    const netFlowCol = currentCol;
    currentCol++;

    row2.getCell(currentCol).value = 'SALDO ACUMULADO';
    row2.getCell(currentCol).fill = headerFill;
    row2.getCell(currentCol).font = headerFont;
    const balanceCol = currentCol;

    // Fila 3: Subcolumnas
    const row3 = sheet.getRow(3);
    
    // Merge FECHA
    sheet.mergeCells('A2:A3');
    row3.getCell(1).border = { bottom: { style: 'medium' } };

    let subCol = 2;
    for (const col of data.columns.incomes) {
      const cell = row3.getCell(subCol++);
      cell.value = `${col.accountName}\n${col.paymentMethod}`;
      cell.fill = subheaderFill;
      cell.font = { bold: true };
      cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
      sheet.getColumn(cell.col).width = 15;
    }

    sheet.mergeCells(2, totalIncomeCol, 3, totalIncomeCol);
    sheet.getColumn(totalIncomeCol).width = 18;

    subCol = totalIncomeCol + 1;
    for (const col of data.columns.expenses) {
      const cell = row3.getCell(subCol++);
      cell.value = `${col.accountName}\n${col.paymentMethod}`;
      cell.fill = subheaderFill;
      cell.font = { bold: true };
      cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
      sheet.getColumn(cell.col).width = 15;
    }

    sheet.mergeCells(2, totalExpenseCol, 3, totalExpenseCol);
    sheet.getColumn(totalExpenseCol).width = 18;

    sheet.mergeCells(2, netFlowCol, 3, netFlowCol);
    sheet.getColumn(netFlowCol).width = 18;

    sheet.mergeCells(2, balanceCol, 3, balanceCol);
    sheet.getColumn(balanceCol).width = 20;
    
    sheet.getColumn(1).width = 12; // FECHA width
    row3.height = 30;

    // --- FILA 4: SALDO ANTERIOR ---
    const row4 = sheet.addRow([]);
    row4.getCell(1).value = 'SALDO ANTERIOR';
    row4.getCell(1).font = { bold: true, italic: true };
    
    const openingBalanceCell = row4.getCell(balanceCol);
    openingBalanceCell.value = data.openingBalance;
    openingBalanceCell.numFmt = moneyFormat;
    openingBalanceCell.font = { bold: true, italic: true };

    // --- MATRIZ DIARIA ---
    for (const day of data.days) {
      const row = sheet.addRow([]);
      
      row.getCell(1).value = day.date;
      row.getCell(1).numFmt = 'dd/mm/yyyy';

      let cIdx = 2;
      for (const col of data.columns.incomes) {
        const cell = row.getCell(cIdx++);
        cell.value = day.incomes[col.key] || 0;
        cell.numFmt = moneyFormat;
      }

      const totalIncCell = row.getCell(totalIncomeCol);
      totalIncCell.value = day.dailyTotalIncome;
      totalIncCell.numFmt = moneyFormat;
      totalIncCell.font = { bold: true };

      cIdx = totalIncomeCol + 1;
      for (const col of data.columns.expenses) {
        const cell = row.getCell(cIdx++);
        cell.value = day.expenses[col.key] || 0;
        cell.numFmt = moneyFormat;
      }

      const totalExpCell = row.getCell(totalExpenseCol);
      totalExpCell.value = day.dailyTotalExpense;
      totalExpCell.numFmt = moneyFormat;
      totalExpCell.font = { bold: true };

      const netFlowCell = row.getCell(netFlowCol);
      netFlowCell.value = day.dailyNetFlow;
      netFlowCell.numFmt = moneyFormat;
      netFlowCell.font = { bold: true };

      const balanceCell = row.getCell(balanceCol);
      balanceCell.value = day.dailyAccumulatedBalance;
      balanceCell.numFmt = moneyFormat;
      balanceCell.font = { bold: true };
    }

    // --- SUBTOTALES ---
    const subtotalRow = sheet.addRow([]);
    subtotalRow.getCell(1).value = 'SUBTOTALES';
    subtotalRow.getCell(1).font = headerFont;
    subtotalRow.getCell(1).fill = headerFill;

    let cIdxSub = 2;
    for (const col of data.columns.incomes) {
      const cell = subtotalRow.getCell(cIdxSub++);
      cell.value = data.monthlyTotals.incomes[col.key] || 0;
      cell.numFmt = moneyFormat;
      cell.font = { bold: true };
      cell.fill = subheaderFill;
    }

    const totalIncSubCell = subtotalRow.getCell(totalIncomeCol);
    totalIncSubCell.value = data.monthlyTotals.totalIncome;
    totalIncSubCell.numFmt = moneyFormat;
    totalIncSubCell.font = headerFont;
    totalIncSubCell.fill = headerFill;

    cIdxSub = totalIncomeCol + 1;
    for (const col of data.columns.expenses) {
      const cell = subtotalRow.getCell(cIdxSub++);
      cell.value = data.monthlyTotals.expenses[col.key] || 0;
      cell.numFmt = moneyFormat;
      cell.font = { bold: true };
      cell.fill = subheaderFill;
    }

    const totalExpSubCell = subtotalRow.getCell(totalExpenseCol);
    totalExpSubCell.value = data.monthlyTotals.totalExpense;
    totalExpSubCell.numFmt = moneyFormat;
    totalExpSubCell.font = headerFont;
    totalExpSubCell.fill = headerFill;

    const netFlowSubCell = subtotalRow.getCell(netFlowCol);
    netFlowSubCell.value = data.monthlyTotals.netFlow;
    netFlowSubCell.numFmt = moneyFormat;
    netFlowSubCell.font = headerFont;
    netFlowSubCell.fill = headerFill;

    const balanceSubCell = subtotalRow.getCell(balanceCol);
    balanceSubCell.value = data.closingBalance;
    balanceSubCell.numFmt = moneyFormat;
    balanceSubCell.font = headerFont;
    balanceSubCell.fill = headerFill;
  }

  private createDetailsSheet(workbook: ExcelJS.Workbook, data: MonthlyCashflowData) {
    const sheet = workbook.addWorksheet('Detalle de Movimientos', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheet.columns = [
      { header: 'FECHA', key: 'date', width: 12 },
      { header: 'ID TRANSACCIÓN', key: 'id', width: 25 },
      { header: 'TIPO', key: 'type', width: 10 },
      { header: 'CUENTA FINANCIERA', key: 'account', width: 20 },
      { header: 'MEDIO DE PAGO', key: 'method', width: 15 },
      { header: 'CATEGORÍA', key: 'category', width: 20 },
      { header: 'ORIGEN', key: 'origin', width: 20 },
      { header: 'DISCIPLINA', key: 'discipline', width: 15 },
      { header: 'PAGADOR', key: 'payer', width: 25 },
      { header: 'BENEFICIARIO', key: 'beneficiary', width: 25 },
      { header: 'REFERENCIA / DESC', key: 'ref', width: 25 },
      { header: 'MONTO (Bs)', key: 'amount', width: 15 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = <ExcelJS.Fill>{ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    sheet.autoFilter = 'A1:L1';

    for (const d of data.details) {
      sheet.addRow({
        date: d.date,
        id: d.transactionId,
        type: d.type === 'INCOME' ? 'INGRESO' : 'EGRESO',
        account: d.accountName,
        method: d.paymentMethod,
        category: d.categoryName,
        origin: d.origin,
        discipline: d.discipline || '-',
        payer: d.payer || '-',
        beneficiary: d.beneficiary || '-',
        ref: d.reference || '-',
        amount: d.amount,
      });
    }

    sheet.getColumn('date').numFmt = 'dd/mm/yyyy';
    sheet.getColumn('amount').numFmt = '"Bs" #,##0.00;[Red]-"Bs" #,##0.00';
  }

  private createInternalTransfersSheet(workbook: ExcelJS.Workbook, data: MonthlyCashflowData) {
    const sheet = workbook.addWorksheet('Movimientos Internos', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheet.columns = [
      { header: 'FECHA', key: 'date', width: 12 },
      { header: 'ID TRANSFERENCIA', key: 'id', width: 25 },
      { header: 'ORIGEN', key: 'source', width: 20 },
      { header: 'DESTINO', key: 'dest', width: 20 },
      { header: 'MEDIO DE PAGO', key: 'method', width: 15 },
      { header: 'MONTO (Bs)', key: 'amount', width: 15 },
      { header: 'REFERENCIA', key: 'ref', width: 30 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = <ExcelJS.Fill>{ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF548235' } }; // Un color distinto
    sheet.autoFilter = 'A1:G1';

    for (const t of data.internalTransfers) {
      sheet.addRow({
        date: t.date,
        id: t.transactionId,
        source: t.sourceAccount,
        dest: t.destinationAccount,
        method: t.paymentMethod,
        amount: t.amount,
        ref: t.reference || '-',
      });
    }

    sheet.getColumn('date').numFmt = 'dd/mm/yyyy';
    sheet.getColumn('amount').numFmt = '"Bs" #,##0.00';
  }
}
