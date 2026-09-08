import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { MonthlyAccountingService } from './monthly-accounting.service';
import { MonthlyAccountingQueryDto } from './dto/monthly-accounting.dto';
import { TransactionStatus } from '../generated/prisma/client';

@Injectable()
export class MonthlyAccountingExcelService {
  constructor(private readonly accountingService: MonthlyAccountingService) {}

  async generateExcel(query: MonthlyAccountingQueryDto): Promise<ExcelJS.Workbook> {
    const data = await this.accountingService.getAccountingData(query);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema CAN';
    wb.created = new Date();

    const monthStr = `${query.year}-${query.month.toString().padStart(2, '0')}`;
    const numFmt = '#,##0.00';

    // Helper to categorize transaction
    const categorizeTx = (tx: any) => {
      let categoryGroup = 'SIN CATEGORÍA';
      let discipline = '';
      const charge = tx.payment?.charge;

      if (charge) {
        if (charge.studentCharges && charge.studentCharges.length > 0) {
          discipline = charge.studentCharges[0].studentMembership?.courseSeason?.course?.school?.discipline?.name || '';
          categoryGroup = `Escuelas${discipline ? ' - ' + discipline : ''}`;
        } else if (charge.membershipCharges && charge.membershipCharges.length > 0) {
          discipline = charge.membershipCharges[0].playerMembership?.teamSeason?.team?.club?.discipline?.name || '';
          categoryGroup = `Equipos${discipline ? ' - ' + discipline : ''}`;
        } else if (charge.accountCharge?.category) {
          categoryGroup = charge.accountCharge.category.name;
        }
      }

      return { categoryGroup, discipline };
    };

    // Prepare Daily Data Map
    const daysInMonth = new Date(Date.UTC(query.year, query.month, 0)).getUTCDate();
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
      return {
        day: i + 1,
        incomes: {} as Record<string, Record<string, number>>,
        expenses: {} as Record<string, Record<string, number>>,
        internalIn: 0,
        internalOut: 0,
        totalIncome: 0,
        totalExpense: 0,
      };
    });

    // Prepare Accounts Balance tracking
    const accountBalances = new Map<string, number>();
    data.accounts.forEach(acc => accountBalances.set(acc.id, acc.openingBalance));

    // Distribution Map for Sheet 2
    // Key: categoryGroup, Value: Map<accountId, amount>
    const distributionMatrix = new Map<string, Map<string, number>>();
    const getDistCell = (cat: string, accId: string) => {
      if (!distributionMatrix.has(cat)) distributionMatrix.set(cat, new Map());
      const map = distributionMatrix.get(cat);
      return map.get(accId) || 0;
    };
    const addDistCell = (cat: string, accId: string, amount: number) => {
      if (!distributionMatrix.has(cat)) distributionMatrix.set(cat, new Map());
      const map = distributionMatrix.get(cat);
      map.set(accId, (map.get(accId) || 0) + amount);
    };

    const uniqueIncomes = new Set<string>();
    const uniqueExpenses = new Set<string>();

    for (const tx of data.transactions) {
      const txAny = tx as any;
      const day = tx.transactionDate.getUTCDate();
      const metrics = dailyData[day - 1];
      const { categoryGroup } = categorizeTx(tx);
      const amount = Number(tx.amount) || 0;
      const accId = tx.financialAccountId;

      const isOperative =
        tx.status === TransactionStatus.COMPLETED ||
        (tx.status === TransactionStatus.CANCELLED && txAny.reversedBy !== null && txAny.reversedBy !== undefined);

      if (!isOperative) {
        continue;
      }

      if (tx.isInternalTransfer) {
        const isSource = !!txAny.internalTransferSource;
        const isDest = !!txAny.internalTransferDest;

        if (isSource) {
          metrics.internalOut += amount;
          accountBalances.set(accId, (accountBalances.get(accId) || 0) - amount);
        } else if (isDest) {
          metrics.internalIn += amount;
          accountBalances.set(accId, (accountBalances.get(accId) || 0) + amount);
        }
      } else {
        if (tx.type === 'INCOME') {
          uniqueIncomes.add(categoryGroup);
          if (!metrics.incomes[categoryGroup]) metrics.incomes[categoryGroup] = {};
          metrics.incomes[categoryGroup][accId] = (metrics.incomes[categoryGroup][accId] || 0) + amount;
          metrics.totalIncome += amount;
          accountBalances.set(accId, (accountBalances.get(accId) || 0) + amount);
          addDistCell(categoryGroup, accId, amount);
        } else if (tx.type === 'EXPENSE') {
          uniqueExpenses.add(categoryGroup);
          if (!metrics.expenses[categoryGroup]) metrics.expenses[categoryGroup] = {};
          metrics.expenses[categoryGroup][accId] = (metrics.expenses[categoryGroup][accId] || 0) + amount;
          metrics.totalExpense += amount;
          accountBalances.set(accId, (accountBalances.get(accId) || 0) - amount);
          addDistCell(categoryGroup, accId, -amount);
        }
      }
    }

    // --- CÁLCULO DE TOTALES PREVIOS AL RENDERIZADO ---
    let sumTotalIncome = 0;
    let sumTotalExpense = 0;
    let sumInternalIn = 0;
    let sumInternalOut = 0;
    let sumNet = 0;
    const incomeTotals: Record<string, Record<string, number>> = {};
    const expenseTotals: Record<string, Record<string, number>> = {};

    const incomeCols = Array.from(uniqueIncomes).sort();
    const expenseCols = Array.from(uniqueExpenses).sort();

    for (const inc of incomeCols) incomeTotals[inc] = {};
    for (const exp of expenseCols) expenseTotals[exp] = {};

    for (const d of dailyData) {
      sumTotalIncome += d.totalIncome;
      sumTotalExpense += d.totalExpense;
      sumInternalIn += d.internalIn;
      sumInternalOut += d.internalOut;
      sumNet += (d.totalIncome - d.totalExpense);
      
      for (const inc of incomeCols) {
        if (!d.incomes[inc]) d.incomes[inc] = {};
        for (const acc of data.accounts) {
          const val = d.incomes[inc][acc.id] || 0;
          incomeTotals[inc][acc.id] = (incomeTotals[inc][acc.id] || 0) + val;
        }
      }
      for (const exp of expenseCols) {
        if (!d.expenses[exp]) d.expenses[exp] = {};
        for (const acc of data.accounts) {
          const val = d.expenses[exp][acc.id] || 0;
          expenseTotals[exp][acc.id] = (expenseTotals[exp][acc.id] || 0) + val;
        }
      }
    }



    const activeIncomeAccounts: Record<string, any[]> = {};
    for (const inc of incomeCols) {
      activeIncomeAccounts[inc] = data.accounts.filter(acc => Math.abs(incomeTotals[inc][acc.id] || 0) > 0);
    }
    const activeExpenseAccounts: Record<string, any[]> = {};
    for (const exp of expenseCols) {
      activeExpenseAccounts[exp] = data.accounts.filter(acc => Math.abs(expenseTotals[exp][acc.id] || 0) > 0);
    }

    let sysOpening = 0;
    let sysClosing = 0;
    for (const acc of data.accounts) {
      sysOpening += acc.openingBalance;
      sysClosing += accountBalances.get(acc.id) || 0;
    }

    // --- ESTILOS COMUNES ---
    const borderSutil: Partial<ExcelJS.Borders> = {
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
    const borderTotal: Partial<ExcelJS.Borders> = {
      top: { style: 'medium', color: { argb: 'FF1F4E79' } },
      bottom: { style: 'thin', color: { argb: 'FF1F4E79' } }
    };
    const fillTitle: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    const fontTitle: Partial<ExcelJS.Font> = { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    
    // --- HOJA 1: RESUMEN MENSUAL ---
    const ws1 = wb.addWorksheet(`Resumen ${monthStr}`, {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    
    // --- CABECERA INSTITUCIONAL (Estilo Recibos) ---
    let logoPath = path.join(process.cwd(), 'dist', 'assets', 'logo-can.png');
    if (!fs.existsSync(logoPath)) {
      logoPath = path.join(process.cwd(), 'src', 'assets', 'logo-can.png');
    }
    if (fs.existsSync(logoPath)) {
      const logoId = wb.addImage({
        filename: logoPath,
        extension: 'png',
      });
      ws1.addImage(logoId, {
        tl: { col: 0, row: 0 },
        ext: { width: 85, height: 85 }
      });
    }

    let totalCols = 1;
    for (const inc of incomeCols) totalCols += activeIncomeAccounts[inc].length + 1;
    totalCols += 1; // TOTAL INGRESOS
    for (const exp of expenseCols) totalCols += activeExpenseAccounts[exp].length + 1;
    totalCols += 1; // TOTAL EGRESOS
    totalCols += 3; // INT IN, INT OUT, NETO

    ws1.mergeCells(1, 1, 1, totalCols);
    const titleCell = ws1.getCell(1, 1);
    titleCell.value = 'CLUB ATLÉTICO NACIONAL';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1F4E79' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    
    ws1.mergeCells(2, 1, 2, totalCols);
    const subInstCell = ws1.getCell(2, 1);
    subInstCell.value = 'FUNDADO EL 17 DE OCTUBRE DE 1935';
    subInstCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF595959' } };
    subInstCell.alignment = { vertical: 'middle', horizontal: 'center' };

    ws1.mergeCells(3, 1, 3, totalCols);
    const repTitleCell = ws1.getCell(3, 1);
    repTitleCell.value = 'INFORME CONTABLE MENSUAL';
    repTitleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1F4E79' } };
    repTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    ws1.mergeCells(4, 1, 4, totalCols);
    const subtitleCell = ws1.getCell(4, 1);
    subtitleCell.value = `Periodo: ${monthStr}  |  Generado: ${new Date().toLocaleString('es-BO')}`;
    subtitleCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF595959' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    
    ws1.addRow([]);

    // --- RESUMEN EJECUTIVO (Dashboard Style) ---
    ws1.addRow(['SALDO INICIAL', 'TOTAL INGRESOS', 'TOTAL EGRESOS', 'SALDO FINAL']);
    const execHeaderRow = ws1.lastRow;
    if (execHeaderRow) {
      execHeaderRow.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF595959' } };
      execHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
      execHeaderRow.height = 20;
    }

    ws1.addRow([sysOpening, sumTotalIncome, sumTotalExpense === 0 ? 0 : -sumTotalExpense, sysClosing]);
    const execValueRow = ws1.lastRow;
    if (execValueRow) {
      execValueRow.height = 30;
      execValueRow.font = { name: 'Calibri', bold: true, size: 14 };
      execValueRow.alignment = { horizontal: 'center', vertical: 'middle' };
      execValueRow.eachCell(cell => { cell.numFmt = numFmt; });
      
      execValueRow.getCell(1).font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FF1F4E79' } };
      execValueRow.getCell(2).font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FF27AE60' } };
      execValueRow.getCell(3).font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FFC0392B' } };
      execValueRow.getCell(4).font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FF1F4E79' } };
      
      for(let i = 1; i <= 4; i++) {
        execHeaderRow!.getCell(i).border = { top: { style: 'medium', color: {argb:'FFBDD7EE'} }, left: { style: 'thin', color: {argb:'FFBDD7EE'} }, right: { style: 'thin', color: {argb:'FFBDD7EE'} } };
        execHeaderRow!.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6FA' } };
        
        execValueRow.getCell(i).border = { bottom: { style: 'medium', color: {argb:'FFBDD7EE'} }, left: { style: 'thin', color: {argb:'FFBDD7EE'} }, right: { style: 'thin', color: {argb:'FFBDD7EE'} } };
        execValueRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6FA' } };
      }
    }

    ws1.addRow([]);
    ws1.addRow([]);

    // Matriz Diaria Jerárquica
    const row8 = ['Día'];
    const row9 = [''];
    
    // Generar estructura Income
    for (const inc of incomeCols) {
      row8.push(inc);
      for (const acc of activeIncomeAccounts[inc]) row9.push(acc.name);
      row9.push('TOTAL');
      
      for (let i = 0; i < activeIncomeAccounts[inc].length; i++) {
        row8.push(''); // blank spaces for mergeCells
      }
    }
    row8.push('TOTAL INGRESOS');
    row9.push('');
    
    // Generar estructura Expense
    for (const exp of expenseCols) {
      row8.push(exp);
      for (const acc of activeExpenseAccounts[exp]) row9.push(acc.name);
      row9.push('TOTAL');
      
      for (let i = 0; i < activeExpenseAccounts[exp].length; i++) {
        row8.push(''); // blank spaces for mergeCells
      }
    }
    row8.push('TOTAL EGRESOS');
    row9.push('');
    
    row8.push('ENTRADAS INTERNAS', 'SALIDAS INTERNAS', 'NETO OPERATIVO');
    row9.push('', '', '');
    
    ws1.addRow(row8);
    const r8 = ws1.lastRow!;
    r8.height = 25;
    ws1.addRow(row9);
    const r9 = ws1.lastRow!;
    r9.height = 25;
    
    // Aplicar mergeCells y estilos a las cabeceras jerárquicas
    const applyHeaderStyle = (cell: ExcelJS.Cell, bgColor: string, textColor: string, isMainHeader: boolean = false) => {
       cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
       cell.font = { name: 'Calibri', color: { argb: textColor }, bold: true, size: isMainHeader ? 11 : 10 };
       cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
       cell.border = { 
         top: { style: isMainHeader ? 'medium' : 'thin', color: { argb: 'FFFFFFFF' } },
         right: { style: 'thin', color: { argb: 'FFFFFFFF' } }, 
         bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } }, 
         left: { style: 'thin', color: { argb: 'FFFFFFFF' } } 
       };
    };
    
    let currentIdx = 2; // Empieza en la columna 2 (B)
    
    // Día
    ws1.mergeCells(10, 1, 11, 1);
    applyHeaderStyle(ws1.getCell(10, 1), 'FFE9ECEF', 'FF495057', true);

    // Incomes (Verde suave)
    for (let j = 0; j < incomeCols.length; j++) {
      const inc = incomeCols[j];
      const span = activeIncomeAccounts[inc].length + 1;
      ws1.mergeCells(10, currentIdx, 10, currentIdx + span - 1);
      applyHeaderStyle(ws1.getCell(10, currentIdx), 'FFE8F5E9', 'FF2E7D32', true);
      
      for (let i = 0; i < span; i++) {
        applyHeaderStyle(ws1.getCell(11, currentIdx + i), 'FFF1F8E9', 'FF33691E');
      }
      currentIdx += span;
    }
    
    // Total Ingresos
    ws1.mergeCells(10, currentIdx, 11, currentIdx);
    applyHeaderStyle(ws1.getCell(10, currentIdx), 'FFC8E6C9', 'FF1B5E20', true);
    currentIdx++;

    // Expenses (Rojo suave)
    for (let j = 0; j < expenseCols.length; j++) {
      const exp = expenseCols[j];
      const span = activeExpenseAccounts[exp].length + 1;
      ws1.mergeCells(10, currentIdx, 10, currentIdx + span - 1);
      applyHeaderStyle(ws1.getCell(10, currentIdx), 'FFFFEBEE', 'FFC62828', true);
      
      for (let i = 0; i < span; i++) {
        applyHeaderStyle(ws1.getCell(11, currentIdx + i), 'FFFFF3E0', 'FFBF360C');
      }
      currentIdx += span;
    }
    
    // Total Egresos
    ws1.mergeCells(10, currentIdx, 11, currentIdx);
    applyHeaderStyle(ws1.getCell(10, currentIdx), 'FFFFCDD2', 'FFB71C1C', true);
    currentIdx++;
    
    // Internal & Net (Azul grisáceo)
    for (let i = 0; i < 2; i++) {
      ws1.mergeCells(10, currentIdx + i, 11, currentIdx + i);
      applyHeaderStyle(ws1.getCell(10, currentIdx + i), 'FFE3F2FD', 'FF1565C0', true);
    }
    
    // NETO OPERATIVO
    ws1.mergeCells(10, currentIdx + 2, 11, currentIdx + 2);
    applyHeaderStyle(ws1.getCell(10, currentIdx + 2), 'FFE1F5FE', 'FF0277BD', true);

    let rowIndex = 0;
    for (const d of dailyData) {
      const formattedDate = `${String(d.day).padStart(2, '0')}-${String(query.month).padStart(2, '0')}-${query.year}`;
      const row: any[] = [formattedDate];
      
      for (const inc of incomeCols) {
        let catTotal = 0;
        for (const acc of activeIncomeAccounts[inc]) {
          const val = d.incomes[inc][acc.id] || 0;
          row.push(val);
          catTotal += val;
        }
        row.push(catTotal);
      }
      row.push(d.totalIncome);
      
      for (const exp of expenseCols) {
        let catTotal = 0;
        for (const acc of activeExpenseAccounts[exp]) {
          const val = d.expenses[exp][acc.id] || 0;
          row.push(val === 0 ? 0 : -val);
          catTotal += val;
        }
        row.push(catTotal === 0 ? 0 : -catTotal);
      }
      row.push(d.totalExpense === 0 ? 0 : -d.totalExpense);
      
      row.push(d.internalIn);
      row.push(d.internalOut === 0 ? 0 : -d.internalOut);
      row.push(d.totalIncome - d.totalExpense);

      const excelRow = ws1.addRow(row);
      rowIndex++;
      const isZebra = rowIndex % 2 === 0;
      const rowFill: ExcelJS.Fill = isZebra ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } } : { type: 'pattern', pattern: 'none' };
      
      excelRow.eachCell((cell, colNumber) => {
        if (colNumber > 1) cell.numFmt = numFmt;
        cell.border = borderSutil;
        cell.fill = rowFill;
      });
      
      let cIdx = 1;
      for (const inc of incomeCols) {
        cIdx += activeIncomeAccounts[inc].length + 1;
        excelRow.getCell(cIdx).font = { color: { argb: 'FF2E7D32' }, bold: true };
      }
      cIdx++;
      excelRow.getCell(cIdx).font = { color: { argb: 'FF1B5E20' }, bold: true };
      
      for (const exp of expenseCols) {
        cIdx += activeExpenseAccounts[exp].length + 1;
        excelRow.getCell(cIdx).font = { color: { argb: 'FFC62828' }, bold: true };
      }
      cIdx++;
      excelRow.getCell(cIdx).font = { color: { argb: 'FFB71C1C' }, bold: true };
    }

    // Fila de Totales
    const totalsRow: any[] = ['TOTALES'];
    for (const inc of incomeCols) {
      let superTotal = 0;
      for (const acc of activeIncomeAccounts[inc]) {
        const val = incomeTotals[inc][acc.id] || 0;
        totalsRow.push(val);
        superTotal += val;
      }
      totalsRow.push(superTotal);
    }
    totalsRow.push(sumTotalIncome);
    
    for (const exp of expenseCols) {
      let superTotal = 0;
      for (const acc of activeExpenseAccounts[exp]) {
        const val = expenseTotals[exp][acc.id] || 0;
        totalsRow.push(val === 0 ? 0 : -val);
        superTotal += val;
      }
      totalsRow.push(superTotal === 0 ? 0 : -superTotal);
    }
    totalsRow.push(sumTotalExpense === 0 ? 0 : -sumTotalExpense);
    
    totalsRow.push(sumInternalIn, sumInternalOut === 0 ? 0 : -sumInternalOut, sumNet);

    const tRow = ws1.addRow(totalsRow);
    tRow.height = 25;
    tRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, name: 'Calibri', size: 11 };
      cell.border = borderTotal;
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      if (colNumber === 1) cell.alignment.horizontal = 'center';
      if (colNumber > 1) cell.numFmt = numFmt;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6EEF8' } };
    });

    // Ajuste de anchos Hoja 1
    ws1.getColumn(1).width = 10;
    for(let i=2; i<=row8.length; i++) ws1.getColumn(i).width = 14;
    
    ws1.views = [{ state: 'frozen', xSplit: 1, ySplit: 11 }];
    ws1.autoFilter = { from: { row: 11, column: 1 }, to: { row: 11, column: row8.length } };

    // --- HOJA 2: DISTRIBUCIÓN CONTABLE ---
    const ws2 = wb.addWorksheet(`Distribución ${monthStr}`, {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    
    const distHeaders = ['Categoría', ...data.accounts.map(a => a.name), 'TOTAL'];

    ws2.mergeCells(1, 1, 1, distHeaders.length);
    const dTitle = ws2.getCell(1, 1);
    dTitle.value = 'DISTRIBUCIÓN CONTABLE';
    dTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1F4E79' } };
    dTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    
    ws2.mergeCells(2, 1, 2, distHeaders.length);
    const dSubtitle = ws2.getCell(2, 1);
    dSubtitle.value = `Periodo: ${monthStr}`;
    dSubtitle.font = { name: 'Calibri', size: 11, color: { argb: 'FF595959' } };
    dSubtitle.alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.addRow([]);

    ws2.addRow(distHeaders);
    const dHeaderRow = ws2.lastRow;
    if (dHeaderRow) {
      dHeaderRow.height = 25;
      dHeaderRow.eachCell(cell => {
        cell.fill = fillTitle;
        cell.font = fontTitle;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    }

    const categories = Array.from(distributionMatrix.keys()).sort();
    let dRowIndex = 0;
    for (const cat of categories) {
      const row: any[] = [cat];
      let catTotal = 0;
      for (const acc of data.accounts) {
        const val = getDistCell(cat, acc.id);
        row.push(val);
        catTotal += val;
      }
      row.push(catTotal);
      const eRow = ws2.addRow(row);
      dRowIndex++;
      const isZebra = dRowIndex % 2 === 0;
      eRow.eachCell((cell, colNumber) => {
        if (colNumber > 1) cell.numFmt = numFmt;
        cell.border = borderSutil;
        cell.fill = isZebra ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } } : { type: 'pattern', pattern: 'none' };
      });
      eRow.getCell(distHeaders.length).font = { bold: true };
    }

    // Totales Hoja 2
    const dTotalRowData: any[] = ['TOTAL'];
    let dSuperTotal = 0;
    for (const acc of data.accounts) {
      let accSum = 0;
      for (const cat of categories) {
        accSum += getDistCell(cat, acc.id);
      }
      dTotalRowData.push(accSum);
      dSuperTotal += accSum;
    }
    dTotalRowData.push(dSuperTotal);

    const dTRow = ws2.addRow(dTotalRowData);
    dTRow.height = 25;
    dTRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, name: 'Calibri' };
      cell.border = borderTotal;
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      if(colNumber===1) cell.alignment.horizontal = 'left';
      if(colNumber > 1) cell.numFmt = numFmt;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6EEF8' } };
    });

    ws2.getColumn(1).width = 30;
    for(let i=2; i<=distHeaders.length; i++) ws2.getColumn(i).width = 18;

    ws2.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }];
    ws2.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: distHeaders.length } };


    // --- HOJA 3: DETALLE DE MOVIMIENTOS ---
    const ws3 = wb.addWorksheet(`Detalle ${monthStr}`);
    
    ws3.mergeCells(1, 1, 1, 16);
    const detTitle = ws3.getCell(1, 1);
    detTitle.value = 'DETALLE DE TRANSACCIONES';
    detTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1F4E79' } };
    detTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    
    ws3.mergeCells(2, 1, 2, 16);
    const detSubtitle = ws3.getCell(2, 1);
    detSubtitle.value = `Periodo: ${monthStr}`;
    detSubtitle.font = { name: 'Calibri', size: 11, color: { argb: 'FF595959' } };
    detSubtitle.alignment = { vertical: 'middle', horizontal: 'center' };
    ws3.addRow([]);

    ws3.columns = [
      { header: 'ID Transacción', key: 'id', width: 36 },
      { header: 'Fecha (Local)', key: 'date', width: 16 },
      { header: 'Recibo', key: 'receipt', width: 15 },
      { header: 'Tipo', key: 'type', width: 15 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Cuenta Financiera', key: 'account', width: 20 },
      { header: 'Método Pago', key: 'paymentMethod', width: 15 },
      { header: 'Categoría/Origen', key: 'category', width: 30 },
      { header: 'Disciplina', key: 'discipline', width: 15 },
      { header: 'Monto', key: 'amount', width: 15 },
      { header: 'Balance Antes', key: 'balanceBefore', width: 15 },
      { header: 'Balance Después', key: 'balanceAfter', width: 15 },
      { header: 'Payment ID', key: 'paymentId', width: 36 },
      { header: 'Charge ID', key: 'chargeId', width: 36 },
      { header: 'Interno', key: 'isInternal', width: 10 },
      { header: 'Reversión (reversesId)', key: 'reversesId', width: 36 },
    ];

    const w3Header = ws3.getRow(4);
    w3Header.height = 25;
    w3Header.eachCell(cell => {
      cell.fill = fillTitle;
      cell.font = fontTitle;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    let detRowIndex = 0;
    for (const tx of data.transactions) {
      const txAny = tx as any;
      const isInternal = tx.isInternalTransfer;
      const { categoryGroup, discipline } = categorizeTx(txAny);
      const amount = Number(tx.amount) || 0;

      const row = ws3.addRow({
        id: tx.id,
        date: tx.transactionDate,
        receipt: `${tx.receiptSeries}-${tx.receiptNumber}`,
        type: tx.type,
        status: tx.status,
        account: txAny.financialAccount?.name || '',
        paymentMethod: tx.paymentMethod,
        category: categoryGroup,
        discipline: discipline,
        amount: tx.type === 'EXPENSE' ? -amount : amount,
        balanceBefore: Number(tx.balanceBefore) || null,
        balanceAfter: Number(tx.balanceAfter) || null,
        paymentId: tx.paymentId,
        chargeId: txAny.payment?.chargeId,
        isInternal: isInternal ? 'SÍ' : 'NO',
        reversesId: tx.reversesId,
      });

      detRowIndex++;
      const isZebra = detRowIndex % 2 === 0;

      row.eachCell((cell, colNum) => {
        cell.border = borderSutil;
        cell.fill = isZebra ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } } : { type: 'pattern', pattern: 'none' };
        cell.alignment = { vertical: 'middle' };
      });

      row.getCell('date').numFmt = 'dd/mm/yyyy hh:mm';
      row.getCell('amount').numFmt = numFmt;
      row.getCell('balanceBefore').numFmt = numFmt;
      row.getCell('balanceAfter').numFmt = numFmt;

      // Status Formatting
      const statusCell = row.getCell('status');
      if (tx.status === TransactionStatus.CANCELLED) {
        row.font = { color: { argb: 'FF999999' }, italic: true };
        statusCell.font = { color: { argb: 'FFC0392B' }, italic: true, bold: true };
      } else if (tx.status === TransactionStatus.PENDING) {
        statusCell.font = { color: { argb: 'FFB8860B' }, bold: true };
      } else if (tx.status === TransactionStatus.COMPLETED) {
        if(tx.reversesId) {
          statusCell.font = { color: { argb: 'FF8E44AD' }, bold: true }; // Reversal indicator
        } else {
          statusCell.font = { color: { argb: 'FF27AE60' }, bold: true };
        }
      }
    }

    ws3.views = [{ state: 'frozen', ySplit: 4 }];
    ws3.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 16 } };

    return wb;
  }
}
