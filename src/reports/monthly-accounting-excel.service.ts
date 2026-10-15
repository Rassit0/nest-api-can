import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { MonthlyAccountingService } from './monthly-accounting.service';
import { MonthlyAccountingQueryDto } from './dto/monthly-accounting.dto';
import { TransactionStatus } from '../generated/prisma/client';
import { DateUtils } from '../utils/date.utils';

type MatrixKind = 'INCOME' | 'EXPENSE';

interface DailyMatrix {
  categories: string[];
  /** Cuentas con movimiento por categoría (orden de data.accounts) */
  activeAccounts: Record<string, { id: string; name: string; accountNumber?: string | null }[]>;
  /** days[dayIndex][category][accountId] = monto */
  days: Record<string, Record<string, number>>[];
  dayTotals: number[];
  /** totals[category][accountId] */
  totals: Record<string, Record<string, number>>;
  grandTotal: number;
}

/** Un bloque (SALIDAS u ENTRADAS) de la matriz diaria de transferencias */
interface TransferSide {
  /** Cuentas que participaron en este rol (orden de data.accounts) */
  accounts: { id: string; name: string; accountNumber?: string | null }[];
  /** days[dayIndex][accountId] = monto */
  days: Record<string, number>[];
  dayTotals: number[];
  /** totals[accountId] */
  totals: Record<string, number>;
  grandTotal: number;
}

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

    // Helpers de formateo basados en envs.appTimezone (DateUtils)
    const formatLocalDateTime = (d: Date): string => DateUtils.formatLocalDateTime(d);
    const formatAccountHeader = (acc: { name: string; accountNumber?: string | null }): string => {
      const num = acc.accountNumber?.trim();
      return num ? `${acc.name}\nNº ${num}` : acc.name;
    };

    // Lógica de categorización original (Payment → Charge)
    const categorizeTx = (tx: any) => {
      let categoryGroup = 'SIN CATEGORÍA';
      const charge = tx.payment?.charge;
      if (charge) {
        if (charge.studentCharges && charge.studentCharges.length > 0) {
          const discipline = charge.studentCharges[0].studentMembership?.courseSeason?.course?.school?.discipline?.name || '';
          categoryGroup = `Escuelas${discipline ? ' - ' + discipline : ''}`;
        } else if (charge.membershipCharges && charge.membershipCharges.length > 0) {
          const discipline = charge.membershipCharges[0].playerMembership?.teamSeason?.team?.club?.discipline?.name || '';
          categoryGroup = `Equipos${discipline ? ' - ' + discipline : ''}`;
        } else if (charge.accountCharge?.category) {
          categoryGroup = charge.accountCharge.category.name;
        }
      }
      return categoryGroup;
    };

    const isOperative = (tx: any) =>
      tx.status === TransactionStatus.COMPLETED ||
      (tx.status === TransactionStatus.CANCELLED && tx.reversedBy !== null && tx.reversedBy !== undefined);

    // Días del calendario (cálculo puramente civil, sin depender de timezone del host)
    const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const monthLengths = [31, isLeap(query.year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const daysInMonth = monthLengths[query.month - 1];

    // --- ESTILOS COMUNES ---
    const borderSutil: Partial<ExcelJS.Borders> = {
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
    const borderTotal: Partial<ExcelJS.Borders> = {
      top: { style: 'medium', color: { argb: 'FF1F4E79' } },
      bottom: { style: 'thin', color: { argb: 'FF1F4E79' } },
    };
    const fillTitle: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    const fontTitle: Partial<ExcelJS.Font> = { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    const fillTotal: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6EEF8' } };
    const zebraFill = (i: number): ExcelJS.Fill =>
      i % 2 === 0 ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } } : { type: 'pattern', pattern: 'none' };

    // --- AGREGACIÓN: CONCILIACIÓN POR CUENTA ---
    type AccountBalanceSummary = {
      id: string;
      name: string;
      accountNumber?: string | null;
      isActive: boolean;
      openingBalance: number;
      periodIncome: number;
      periodExpense: number;
      transferIn: number;
      transferOut: number;
      closingBalance: number;
    };
    const accountMap = new Map<string, AccountBalanceSummary>();
    data.accounts.forEach((acc) => {
      accountMap.set(acc.id, {
        id: acc.id,
        name: acc.name,
        accountNumber: acc.accountNumber,
        isActive: acc.isActive,
        openingBalance: acc.openingBalance,
        periodIncome: 0,
        periodExpense: 0,
        transferIn: 0,
        transferOut: 0,
        closingBalance: 0,
      });
    });

    // --- AGREGACIÓN: MATRICES DIARIAS (una sola pasada, sin queries adicionales) ---
    const buildEmptyMatrix = (): DailyMatrix => ({
      categories: [],
      activeAccounts: {},
      days: Array.from({ length: daysInMonth }, () => ({})),
      dayTotals: Array.from({ length: daysInMonth }, () => 0),
      totals: {},
      grandTotal: 0,
    });
    const incomeMatrix = buildEmptyMatrix();
    const expenseMatrix = buildEmptyMatrix();

    let globalIncome = 0;
    let globalExpense = 0;

    for (const tx of data.transactions as any[]) {
      if (tx.isInternalTransfer) continue; // Defensa: transferencias nunca entran en las matrices
      if (!isOperative(tx)) continue;
      if (tx.type !== 'INCOME' && tx.type !== 'EXPENSE') continue;

      const amount = Number(tx.amount) || 0;
      const accId: string = tx.financialAccountId;
      const { year, month, day } = DateUtils.getLocalDateParts(tx.transactionDate);
      if (year !== query.year || month !== query.month || day < 1 || day > daysInMonth) continue;

      const matrix = tx.type === 'INCOME' ? incomeMatrix : expenseMatrix;
      const category = categorizeTx(tx);
      const dayCell = matrix.days[day - 1];
      if (!dayCell[category]) dayCell[category] = {};
      dayCell[category][accId] = (dayCell[category][accId] || 0) + amount;
      matrix.dayTotals[day - 1] += amount;
      if (!matrix.totals[category]) matrix.totals[category] = {};
      matrix.totals[category][accId] = (matrix.totals[category][accId] || 0) + amount;
      matrix.grandTotal += amount;

      const acc = accountMap.get(accId);
      if (tx.type === 'INCOME') {
        globalIncome += amount;
        if (acc) acc.periodIncome += amount;
      } else {
        globalExpense += amount;
        if (acc) acc.periodExpense += amount;
      }
    }

    for (const matrix of [incomeMatrix, expenseMatrix]) {
      matrix.categories = Object.keys(matrix.totals).sort();
      for (const cat of matrix.categories) {
        matrix.activeAccounts[cat] = data.accounts
          .filter((a) => Math.abs(matrix.totals[cat][a.id] || 0) > 0)
          .map((a) => ({ id: a.id, name: a.name, accountNumber: a.accountNumber }));
      }
    }

    // --- AGREGACIÓN: MATRIZ DIARIA DE TRANSFERENCIAS ---
    // Solo InternalTransfer COMPLETED. Origen/destino SIEMPRE por relación estructural 1:1
    // (sourceTransaction / destinationTransaction), nunca por type, signo u orden.
    const buildTransferSide = (): TransferSide => ({
      accounts: [],
      days: Array.from({ length: daysInMonth }, () => ({})),
      dayTotals: Array.from({ length: daysInMonth }, () => 0),
      totals: {},
      grandTotal: 0,
    });
    const transferOutSide = buildTransferSide(); // SALIDAS (cuenta origen)
    const transferInSide = buildTransferSide(); // ENTRADAS (cuenta destino)
    const addTransferLeg = (side: TransferSide, accId: string, dayIdx: number, amt: number) => {
      side.days[dayIdx][accId] = (side.days[dayIdx][accId] || 0) + amt;
      side.dayTotals[dayIdx] += amt;
      side.totals[accId] = (side.totals[accId] || 0) + amt;
      side.grandTotal += amt;
    };

    let globalTransferIn = 0;
    let globalTransferOut = 0;
    for (const it of data.internalTransfers as any[]) {
      const amt = Number(it.amount) || 0;
      globalTransferOut += amt;
      globalTransferIn += amt;
      const srcAccId: string | undefined = it.sourceTransaction?.financialAccountId;
      const dstAccId: string | undefined = it.destinationTransaction?.financialAccountId;
      const srcAcc = srcAccId ? accountMap.get(srcAccId) : undefined;
      if (srcAcc) srcAcc.transferOut += amt;
      const destAcc = dstAccId ? accountMap.get(dstAccId) : undefined;
      if (destAcc) destAcc.transferIn += amt;

      // Día civil según envs.appTimezone
      const { year, month, day } = DateUtils.getLocalDateParts(it.date);
      if (year !== query.year || month !== query.month || day < 1 || day > daysInMonth) continue;
      if (srcAccId) addTransferLeg(transferOutSide, srcAccId, day - 1, amt);
      if (dstAccId) addTransferLeg(transferInSide, dstAccId, day - 1, amt);
    }
    // Columnas: solo cuentas que participaron (orden determinista = data.accounts, name ASC)
    for (const side of [transferOutSide, transferInSide]) {
      side.accounts = data.accounts
        .filter((a) => side.totals[a.id] !== undefined)
        .map((a) => ({ id: a.id, name: a.name, accountNumber: a.accountNumber }));
    }

    let globalOpening = 0;
    let globalClosing = 0;
    for (const acc of accountMap.values()) {
      acc.closingBalance = acc.openingBalance + acc.periodIncome - acc.periodExpense + acc.transferIn - acc.transferOut;
      globalOpening += acc.openingBalance;
      globalClosing += acc.closingBalance;
    }

    const reconAccounts = Array.from(accountMap.values()).filter(
      (acc) =>
        acc.isActive ||
        Math.abs(acc.openingBalance) > 0.001 ||
        Math.abs(acc.periodIncome) > 0.001 ||
        Math.abs(acc.periodExpense) > 0.001 ||
        Math.abs(acc.transferIn) > 0.001 ||
        Math.abs(acc.transferOut) > 0.001,
    );

    // --- RENDER: MATRIZ DIARIA (Día × Categoría × Cuenta) ---
    const applyHeaderStyle = (cell: ExcelJS.Cell, bgColor: string, textColor: string, isMainHeader = false) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.font = { name: 'Calibri', color: { argb: textColor }, bold: true, size: isMainHeader ? 11 : 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: isMainHeader ? 'medium' : 'thin', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      };
    };

    const matrixColumnCount = (m: DailyMatrix) =>
      1 + m.categories.reduce((s, c) => s + m.activeAccounts[c].length + 1, 0) + 1;

    const renderDailyMatrix = (ws: ExcelJS.Worksheet, m: DailyMatrix, kind: MatrixKind) => {
      const palette =
        kind === 'INCOME'
          ? { catBg: 'FFE8F5E9', catFg: 'FF2E7D32', subBg: 'FFF1F8E9', subFg: 'FF33691E', totBg: 'FFC8E6C9', totFg: 'FF1B5E20' }
          : { catBg: 'FFFFEBEE', catFg: 'FFC62828', subBg: 'FFFFF3E0', subFg: 'FFBF360C', totBg: 'FFFFCDD2', totFg: 'FFB71C1C' };
      const totalLabel = kind === 'INCOME' ? 'TOTAL INGRESOS' : 'TOTAL EGRESOS';

      const row1: any[] = ['Día'];
      const row2: any[] = [''];
      for (const cat of m.categories) {
        row1.push(cat);
        for (let i = 0; i < m.activeAccounts[cat].length; i++) row1.push('');
        for (const acc of m.activeAccounts[cat]) row2.push(formatAccountHeader(acc));
        row2.push('TOTAL');
      }
      row1.push(totalLabel);
      row2.push('');

      const h1 = ws.addRow(row1);
      h1.height = 25;
      const h2 = ws.addRow(row2);
      h2.height = 30;
      const h1Idx = h1.number;
      const h2Idx = h2.number;

      ws.mergeCells(h1Idx, 1, h2Idx, 1);
      applyHeaderStyle(ws.getCell(h1Idx, 1), 'FFE9ECEF', 'FF495057', true);
      let col = 2;
      for (const cat of m.categories) {
        const span = m.activeAccounts[cat].length + 1;
        if (span > 1) ws.mergeCells(h1Idx, col, h1Idx, col + span - 1);
        applyHeaderStyle(ws.getCell(h1Idx, col), palette.catBg, palette.catFg, true);
        for (let i = 0; i < span; i++) applyHeaderStyle(ws.getCell(h2Idx, col + i), palette.subBg, palette.subFg);
        col += span;
      }
      ws.mergeCells(h1Idx, col, h2Idx, col);
      applyHeaderStyle(ws.getCell(h1Idx, col), palette.totBg, palette.totFg, true);

      const styleCategoryTotals = (excelRow: ExcelJS.Row) => {
        let c = 1;
        for (const cat of m.categories) {
          c += m.activeAccounts[cat].length + 1;
          excelRow.getCell(c).font = { color: { argb: palette.catFg }, bold: true };
        }
        excelRow.getCell(c + 1).font = { color: { argb: palette.totFg }, bold: true };
      };

      for (let d = 0; d < daysInMonth; d++) {
        const dayCell = m.days[d];
        const label = `${String(d + 1).padStart(2, '0')}-${String(query.month).padStart(2, '0')}-${query.year}`;
        const row: any[] = [label];
        for (const cat of m.categories) {
          let catTotal = 0;
          for (const acc of m.activeAccounts[cat]) {
            const val = dayCell[cat]?.[acc.id] || 0;
            row.push(val);
            catTotal += val;
          }
          row.push(catTotal);
        }
        row.push(m.dayTotals[d]);

        const excelRow = ws.addRow(row);
        const fill = zebraFill(d + 1);
        excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber > 1) cell.numFmt = numFmt;
          cell.border = borderSutil;
          cell.fill = fill;
        });
        styleCategoryTotals(excelRow);
      }

      const totalsRow: any[] = ['TOTAL MES'];
      for (const cat of m.categories) {
        let catTotal = 0;
        for (const acc of m.activeAccounts[cat]) {
          const val = m.totals[cat][acc.id] || 0;
          totalsRow.push(val);
          catTotal += val;
        }
        totalsRow.push(catTotal);
      }
      totalsRow.push(m.grandTotal);
      const tRow = ws.addRow(totalsRow);
      tRow.height = 25;
      tRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { bold: true, name: 'Calibri', size: 11 };
        cell.border = borderTotal;
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'right' };
        if (colNumber > 1) cell.numFmt = numFmt;
        cell.fill = fillTotal;
      });

      return { headerRow1: h1Idx, headerRow2: h2Idx, columnCount: row1.length };
    };

    const addInstitutionalHeader = (ws: ExcelJS.Worksheet, title: string, widthCols: number, withLogo: boolean) => {
      if (withLogo) {
        let logoPath = path.join(process.cwd(), 'dist', 'assets', 'logo-can.png');
        if (!fs.existsSync(logoPath)) logoPath = path.join(process.cwd(), 'src', 'assets', 'logo-can.png');
        if (fs.existsSync(logoPath)) {
          const logoId = wb.addImage({ filename: logoPath, extension: 'png' });
          ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 75, height: 75 } });
        }
      }
      const lines: [string, Partial<ExcelJS.Font>][] = [
        ['CLUB ATLÉTICO NACIONAL', { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1F4E79' } }],
        ['FUNDADO EL 17 DE OCTUBRE DE 1935', { name: 'Calibri', size: 10, color: { argb: 'FF595959' } }],
        [title, { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1F4E79' } }],
        [
          `Periodo: ${monthStr}  |  Generado: ${formatLocalDateTime(new Date())}`,
          { name: 'Calibri', size: 11, color: { argb: 'FF595959' } },
        ],
      ];
      lines.forEach(([text, font], i) => {
        const r = i + 1;
        ws.mergeCells(r, 1, r, Math.max(widthCols, 8));
        const cell = ws.getCell(r, 1);
        cell.value = text;
        cell.font = font;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      ws.addRow([]);
    };

    // ==========================================
    // HOJA 1: RESUMEN (saldos ejecutivos, conciliación por cuenta y resumen mensual)
    // ==========================================
    const ws1 = wb.addWorksheet(`Resumen ${monthStr}`, {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    addInstitutionalHeader(ws1, 'INFORME CONTABLE MENSUAL', 8, true);

    // Resumen ejecutivo
    const execHeaderRow = ws1.addRow(['SALDO INICIAL', 'INGRESOS EXTERNOS', 'EGRESOS EXTERNOS', 'SALDO FINAL']);
    execHeaderRow.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF595959' } };
    execHeaderRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    execHeaderRow.height = 28;
    const execValueRow = ws1.addRow([globalOpening, globalIncome, globalExpense === 0 ? 0 : -globalExpense, globalClosing]);
    execValueRow.height = 30;
    execValueRow.alignment = { horizontal: 'center', vertical: 'middle' };
    const execColors = ['FF1F4E79', 'FF27AE60', 'FFC0392B', 'FF1F4E79'];
    for (let i = 1; i <= 4; i++) {
      const hc = execHeaderRow.getCell(i);
      hc.border = {
        top: { style: 'medium', color: { argb: 'FFBDD7EE' } },
        left: { style: 'thin', color: { argb: 'FFBDD7EE' } },
        right: { style: 'thin', color: { argb: 'FFBDD7EE' } },
      };
      hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6FA' } };
      const vc = execValueRow.getCell(i);
      vc.numFmt = numFmt;
      vc.font = { name: 'Calibri', bold: true, size: 13, color: { argb: execColors[i - 1] } };
      vc.border = {
        bottom: { style: 'medium', color: { argb: 'FFBDD7EE' } },
        left: { style: 'thin', color: { argb: 'FFBDD7EE' } },
        right: { style: 'thin', color: { argb: 'FFBDD7EE' } },
      };
      vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6FA' } };
    }
    ws1.addRow([]);

    // Conciliación compacta por cuenta
    const reconTitle = ws1.addRow(['CONCILIACIÓN POR CUENTA FINANCIERA']);
    reconTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F4E79' } };
    const reconHeaderRow = ws1.addRow([
      'Cuenta',
      'Nº Cuenta',
      'Saldo Inicial',
      'Ingresos (+)',
      'Egresos (-)',
      'Transf. Entrantes (+)',
      'Transf. Salientes (-)',
      'Saldo Final',
    ]);
    reconHeaderRow.height = 28;
    reconHeaderRow.eachCell((cell) => {
      cell.fill = fillTitle;
      cell.font = fontTitle;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    reconAccounts.forEach((acc, i) => {
      const row = ws1.addRow([
        acc.name,
        acc.accountNumber?.trim() || '-',
        acc.openingBalance,
        acc.periodIncome,
        acc.periodExpense === 0 ? 0 : -acc.periodExpense,
        acc.transferIn,
        acc.transferOut === 0 ? 0 : -acc.transferOut,
        acc.closingBalance,
      ]);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > 2) cell.numFmt = numFmt;
        cell.border = borderSutil;
        cell.fill = zebraFill(i + 1);
      });
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(8).font = { bold: true };
    });
    const reconTotalRow = ws1.addRow([
      'TOTAL GENERAL',
      '',
      globalOpening,
      globalIncome,
      globalExpense === 0 ? 0 : -globalExpense,
      globalTransferIn,
      globalTransferOut === 0 ? 0 : -globalTransferOut,
      globalClosing,
    ]);
    reconTotalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { bold: true, name: 'Calibri', size: 11 };
      cell.border = borderTotal;
      cell.alignment = { vertical: 'middle', horizontal: colNumber <= 2 ? 'center' : 'right' };
      if (colNumber > 2) cell.numFmt = numFmt;
      cell.fill = fillTotal;
    });

    ws1.getColumn(1).width = 28;
    ws1.getColumn(2).width = 18;
    ws1.getColumn(3).width = 18;
    ws1.getColumn(4).width = 18;
    ws1.getColumn(5).width = 18;
    ws1.getColumn(6).width = 20;
    ws1.getColumn(7).width = 20;
    ws1.getColumn(8).width = 18;

    // ==========================================
    // RESUMEN MENSUAL DE MOVIMIENTOS (debajo de la matriz de ingresos)
    // ==========================================
    ws1.addRow([]);
    ws1.addRow([]);

    const summaryMainTitle = ws1.addRow(['RESUMEN MENSUAL DE MOVIMIENTOS']);
    ws1.mergeCells(summaryMainTitle.number, 1, summaryMainTitle.number, 4);
    summaryMainTitle.height = 26;
    summaryMainTitle.getCell(1).fill = fillTitle;
    summaryMainTitle.getCell(1).font = { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
    summaryMainTitle.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    ws1.addRow([]);

    // --- SECCIÓN A: SALDO INICIAL GLOBAL ---
    const prevMonthLastDateStr = DateUtils.formatLocalDate(new Date(data.startDate.getTime() - 1000));
    const openRow = ws1.addRow([`SALDO INICIAL GLOBAL AL ${prevMonthLastDateStr}`, '', '', globalOpening]);
    ws1.mergeCells(openRow.number, 1, openRow.number, 3);
    openRow.height = 22;
    openRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
    openRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    openRow.getCell(4).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F4E79' } };
    openRow.getCell(4).numFmt = numFmt;
    openRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    openRow.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= 4) {
        c.fill = fillTotal;
        c.border = borderTotal;
      }
    });

    ws1.addRow([]);

    // --- SECCIÓN B: INGRESOS EXTERNOS ---
    const incSecHeader = ws1.addRow(['(1) INGRESOS EXTERNOS']);
    ws1.mergeCells(incSecHeader.number, 1, incSecHeader.number, 4);
    incSecHeader.height = 24;
    incSecHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
    incSecHeader.getCell(1).font = { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    incSecHeader.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    const incColHeader = ws1.addRow(['Categoría / Disciplina', 'Cuenta Financiera', 'Nº Cuenta', 'Monto']);
    incColHeader.height = 20;
    incColHeader.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= 4) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        c.font = { name: 'Calibri', color: { argb: 'FF1B5E20' }, bold: true, size: 10 };
        c.border = borderSutil;
        c.alignment = { vertical: 'middle', horizontal: col === 4 ? 'right' : 'center' };
      }
    });

    let incDetailZebra = 0;
    for (const cat of incomeMatrix.categories) {
      const catRow = ws1.addRow([cat, '', '', '']);
      ws1.mergeCells(catRow.number, 1, catRow.number, 4);
      catRow.height = 20;
      catRow.getCell(1).font = { name: 'Calibri', bold: true, size: 10.5, color: { argb: 'FF1B5E20' } };
      catRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F8E9' } };
      catRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
      catRow.getCell(1).border = borderSutil;

      const accs = incomeMatrix.activeAccounts[cat] || [];
      let catSubtotal = 0;
      for (const acc of accs) {
        const amt = incomeMatrix.totals[cat]?.[acc.id] || 0;
        catSubtotal += amt;
        const dRow = ws1.addRow(['', acc.name, acc.accountNumber?.trim() || '-', amt]);
        dRow.height = 19;
        dRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
        dRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
        dRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
        dRow.getCell(4).numFmt = numFmt;
        dRow.eachCell({ includeEmpty: true }, (c, col) => {
          if (col <= 4) {
            c.border = borderSutil;
            c.fill = zebraFill(++incDetailZebra);
            c.font = { name: 'Calibri', size: 10 };
          }
        });
      }

      const subRow = ws1.addRow([`TOTAL ${cat}`, '', '', catSubtotal]);
      ws1.mergeCells(subRow.number, 1, subRow.number, 3);
      subRow.height = 20;
      subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
      subRow.getCell(1).font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF1B5E20' } };
      subRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
      subRow.getCell(4).font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF1B5E20' } };
      subRow.getCell(4).numFmt = numFmt;
      subRow.eachCell({ includeEmpty: true }, (c, col) => {
        if (col <= 4) {
          c.border = { top: { style: 'thin', color: { argb: 'FFA5D6A7' } }, bottom: { style: 'thin', color: { argb: 'FFA5D6A7' } } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FBE7' } };
        }
      });
    }

    const incTotalRow = ws1.addRow(['TOTAL INGRESOS EXTERNOS', '', '', incomeMatrix.grandTotal]);
    ws1.mergeCells(incTotalRow.number, 1, incTotalRow.number, 3);
    incTotalRow.height = 22;
    incTotalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    incTotalRow.getCell(1).font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF2E7D32' } };
    incTotalRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    incTotalRow.getCell(4).font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF2E7D32' } };
    incTotalRow.getCell(4).numFmt = numFmt;
    incTotalRow.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= 4) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        c.border = borderTotal;
      }
    });

    ws1.addRow([]);

    // --- SECCIÓN C: EGRESOS EXTERNOS ---
    const expSecHeader = ws1.addRow(['(2) EGRESOS EXTERNOS']);
    ws1.mergeCells(expSecHeader.number, 1, expSecHeader.number, 4);
    expSecHeader.height = 24;
    expSecHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC62828' } };
    expSecHeader.getCell(1).font = { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    expSecHeader.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    const expColHeader = ws1.addRow(['Categoría / Concepto', 'Cuenta Financiera', 'Nº Cuenta', 'Monto']);
    expColHeader.height = 20;
    expColHeader.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= 4) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
        c.font = { name: 'Calibri', color: { argb: 'FFB71C1C' }, bold: true, size: 10 };
        c.border = borderSutil;
        c.alignment = { vertical: 'middle', horizontal: col === 4 ? 'right' : 'center' };
      }
    });

    let expDetailZebra = 0;
    for (const cat of expenseMatrix.categories) {
      const catRow = ws1.addRow([cat, '', '', '']);
      ws1.mergeCells(catRow.number, 1, catRow.number, 4);
      catRow.height = 20;
      catRow.getCell(1).font = { name: 'Calibri', bold: true, size: 10.5, color: { argb: 'FFB71C1C' } };
      catRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
      catRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
      catRow.getCell(1).border = borderSutil;

      const accs = expenseMatrix.activeAccounts[cat] || [];
      let catSubtotal = 0;
      for (const acc of accs) {
        const amt = expenseMatrix.totals[cat]?.[acc.id] || 0;
        catSubtotal += amt;
        const dRow = ws1.addRow(['', acc.name, acc.accountNumber?.trim() || '-', amt]);
        dRow.height = 19;
        dRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
        dRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
        dRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
        dRow.getCell(4).numFmt = numFmt;
        dRow.eachCell({ includeEmpty: true }, (c, col) => {
          if (col <= 4) {
            c.border = borderSutil;
            c.fill = zebraFill(++expDetailZebra);
            c.font = { name: 'Calibri', size: 10 };
          }
        });
      }

      const subRow = ws1.addRow([`TOTAL ${cat}`, '', '', catSubtotal]);
      ws1.mergeCells(subRow.number, 1, subRow.number, 3);
      subRow.height = 20;
      subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
      subRow.getCell(1).font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFB71C1C' } };
      subRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
      subRow.getCell(4).font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFB71C1C' } };
      subRow.getCell(4).numFmt = numFmt;
      subRow.eachCell({ includeEmpty: true }, (c, col) => {
        if (col <= 4) {
          c.border = { top: { style: 'thin', color: { argb: 'FFEF9A9A' } }, bottom: { style: 'thin', color: { argb: 'FFEF9A9A' } } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        }
      });
    }

    const expTotalRow = ws1.addRow(['TOTAL EGRESOS EXTERNOS', '', '', expenseMatrix.grandTotal]);
    ws1.mergeCells(expTotalRow.number, 1, expTotalRow.number, 3);
    expTotalRow.height = 22;
    expTotalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    expTotalRow.getCell(1).font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFC62828' } };
    expTotalRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    expTotalRow.getCell(4).font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFC62828' } };
    expTotalRow.getCell(4).numFmt = numFmt;
    expTotalRow.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= 4) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
        c.border = borderTotal;
      }
    });

    ws1.addRow([]);

    // --- RESULTADO DEL PERÍODO ---
    const periodResult = incomeMatrix.grandTotal - expenseMatrix.grandTotal;
    const resSecHeader = ws1.addRow(['RESULTADO DEL PERÍODO (INGRESOS EXTERNOS - EGRESOS EXTERNOS)']);
    ws1.mergeCells(resSecHeader.number, 1, resSecHeader.number, 4);
    resSecHeader.height = 24;
    resSecHeader.getCell(1).fill = fillTitle;
    resSecHeader.getCell(1).font = fontTitle;
    resSecHeader.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    const resIncRow = ws1.addRow(['(+) Total Ingresos Externos (1)', '', '', incomeMatrix.grandTotal]);
    ws1.mergeCells(resIncRow.number, 1, resIncRow.number, 3);
    resIncRow.height = 20;
    resIncRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    resIncRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    resIncRow.getCell(4).numFmt = numFmt;
    resIncRow.eachCell({ includeEmpty: true }, (c, col) => { if (col <= 4) c.border = borderSutil; });

    const resExpRow = ws1.addRow(['(-) Total Egresos Externos (2)', '', '', expenseMatrix.grandTotal === 0 ? 0 : -expenseMatrix.grandTotal]);
    ws1.mergeCells(resExpRow.number, 1, resExpRow.number, 3);
    resExpRow.height = 20;
    resExpRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    resExpRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    resExpRow.getCell(4).numFmt = numFmt;
    resExpRow.eachCell({ includeEmpty: true }, (c, col) => { if (col <= 4) c.border = borderSutil; });

    const resTotalRow = ws1.addRow(['(=) RESULTADO DEL PERÍODO', '', '', periodResult]);
    ws1.mergeCells(resTotalRow.number, 1, resTotalRow.number, 3);
    resTotalRow.height = 22;
    resTotalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    resTotalRow.getCell(1).font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF1F4E79' } };
    resTotalRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    resTotalRow.getCell(4).font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF1F4E79' } };
    resTotalRow.getCell(4).numFmt = numFmt;
    resTotalRow.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= 4) {
        c.fill = fillTotal;
        c.border = borderTotal;
      }
    });

    ws1.addRow([]);

    // --- SECCIÓN D: MOVIMIENTOS INTERNOS (TRANSFERENCIAS) ---
    const trfSecHeader = ws1.addRow(['(3) TRANSFERENCIAS INTERNAS ENTRE CUENTAS']);
    ws1.mergeCells(trfSecHeader.number, 1, trfSecHeader.number, 4);
    trfSecHeader.height = 24;
    trfSecHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE65100' } };
    trfSecHeader.getCell(1).font = { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    trfSecHeader.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    // Subsección: Entradas a cuentas (destino)
    const inBannerRow = ws1.addRow(['ENTRADAS A CUENTAS (DESTINO)', '', '', '']);
    ws1.mergeCells(inBannerRow.number, 1, inBannerRow.number, 4);
    inBannerRow.height = 20;
    inBannerRow.getCell(1).font = { name: 'Calibri', bold: true, size: 10.5, color: { argb: 'FFBF360C' } };
    inBannerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
    inBannerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    inBannerRow.getCell(1).border = borderSutil;

    const inColHeader = ws1.addRow(['Movimiento', 'Cuenta Destino', 'Nº Cuenta', 'Monto']);
    inColHeader.height = 20;
    inColHeader.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= 4) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
        c.font = { name: 'Calibri', color: { argb: 'FFBF360C' }, bold: true, size: 10 };
        c.border = borderSutil;
        c.alignment = { vertical: 'middle', horizontal: col === 4 ? 'right' : 'center' };
      }
    });

    let trfInZebra = 0;
    if (transferInSide.accounts.length === 0) {
      const emptyRow = ws1.addRow(['Entrada Interna', 'Sin movimientos en el período', '-', 0]);
      emptyRow.height = 19;
      emptyRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      emptyRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      emptyRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
      emptyRow.getCell(4).numFmt = numFmt;
      emptyRow.eachCell({ includeEmpty: true }, (c, col) => { if (col <= 4) c.border = borderSutil; });
    } else {
      for (const acc of transferInSide.accounts) {
        const amt = transferInSide.totals[acc.id] || 0;
        const dRow = ws1.addRow(['Entrada Interna', acc.name, acc.accountNumber?.trim() || '-', amt]);
        dRow.height = 19;
        dRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        dRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
        dRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
        dRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
        dRow.getCell(4).numFmt = numFmt;
        dRow.eachCell({ includeEmpty: true }, (c, col) => {
          if (col <= 4) {
            c.border = borderSutil;
            c.fill = zebraFill(++trfInZebra);
            c.font = { name: 'Calibri', size: 10 };
          }
        });
      }
    }

    const trfInTotalRow = ws1.addRow(['TOTAL ENTRADAS INTERNAS', '', '', transferInSide.grandTotal]);
    ws1.mergeCells(trfInTotalRow.number, 1, trfInTotalRow.number, 3);
    trfInTotalRow.height = 20;
    trfInTotalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    trfInTotalRow.getCell(1).font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFBF360C' } };
    trfInTotalRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    trfInTotalRow.getCell(4).font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFBF360C' } };
    trfInTotalRow.getCell(4).numFmt = numFmt;
    trfInTotalRow.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= 4) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        c.border = borderSutil;
      }
    });

    ws1.addRow([]);

    // Subsección: Salidas de cuentas (origen)
    const outBannerRow = ws1.addRow(['SALIDAS DE CUENTAS (ORIGEN)', '', '', '']);
    ws1.mergeCells(outBannerRow.number, 1, outBannerRow.number, 4);
    outBannerRow.height = 20;
    outBannerRow.getCell(1).font = { name: 'Calibri', bold: true, size: 10.5, color: { argb: 'FFBF360C' } };
    outBannerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
    outBannerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    outBannerRow.getCell(1).border = borderSutil;

    const outColHeader = ws1.addRow(['Movimiento', 'Cuenta Origen', 'Nº Cuenta', 'Monto']);
    outColHeader.height = 20;
    outColHeader.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= 4) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
        c.font = { name: 'Calibri', color: { argb: 'FFBF360C' }, bold: true, size: 10 };
        c.border = borderSutil;
        c.alignment = { vertical: 'middle', horizontal: col === 4 ? 'right' : 'center' };
      }
    });

    let trfOutZebra = 0;
    if (transferOutSide.accounts.length === 0) {
      const emptyRow = ws1.addRow(['Salida Interna', 'Sin movimientos en el período', '-', 0]);
      emptyRow.height = 19;
      emptyRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      emptyRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      emptyRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
      emptyRow.getCell(4).numFmt = numFmt;
      emptyRow.eachCell({ includeEmpty: true }, (c, col) => { if (col <= 4) c.border = borderSutil; });
    } else {
      for (const acc of transferOutSide.accounts) {
        const amt = transferOutSide.totals[acc.id] || 0;
        const dRow = ws1.addRow(['Salida Interna', acc.name, acc.accountNumber?.trim() || '-', amt]);
        dRow.height = 19;
        dRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        dRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
        dRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
        dRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
        dRow.getCell(4).numFmt = numFmt;
        dRow.eachCell({ includeEmpty: true }, (c, col) => {
          if (col <= 4) {
            c.border = borderSutil;
            c.fill = zebraFill(++trfOutZebra);
            c.font = { name: 'Calibri', size: 10 };
          }
        });
      }
    }

    const trfOutTotalRow = ws1.addRow(['TOTAL SALIDAS INTERNAS', '', '', transferOutSide.grandTotal]);
    ws1.mergeCells(trfOutTotalRow.number, 1, trfOutTotalRow.number, 3);
    trfOutTotalRow.height = 20;
    trfOutTotalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    trfOutTotalRow.getCell(1).font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFBF360C' } };
    trfOutTotalRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    trfOutTotalRow.getCell(4).font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFBF360C' } };
    trfOutTotalRow.getCell(4).numFmt = numFmt;
    trfOutTotalRow.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= 4) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        c.border = borderSutil;
      }
    });

    const netTransfers = transferInSide.grandTotal - transferOutSide.grandTotal;
    const netTrfRow = ws1.addRow(['NETO TRANSFERENCIAS (ENTRADAS - SALIDAS)', '', '', netTransfers]);
    ws1.mergeCells(netTrfRow.number, 1, netTrfRow.number, 3);
    netTrfRow.height = 22;
    netTrfRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' };
    netTrfRow.getCell(1).font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFE65100' } };
    netTrfRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    netTrfRow.getCell(4).font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFE65100' } };
    netTrfRow.getCell(4).numFmt = numFmt;
    netTrfRow.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= 4) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        c.border = borderTotal;
      }
    });

    ws1.addRow([]);

    // --- SECCIÓN E: SALDO FINAL GLOBAL ---
    const periodLastDateStr = DateUtils.formatLocalDate(new Date(data.endDate.getTime() - 1000));
    const closeRow = ws1.addRow([`SALDO FINAL GLOBAL AL ${periodLastDateStr}`, '', '', globalClosing]);
    ws1.mergeCells(closeRow.number, 1, closeRow.number, 3);
    closeRow.height = 24;
    closeRow.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F4E79' } };
    closeRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    closeRow.getCell(4).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F4E79' } };
    closeRow.getCell(4).numFmt = numFmt;
    closeRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    closeRow.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= 4) {
        c.fill = fillTotal;
        c.border = borderTotal;
      }
    });


    // ==========================================
    // HOJA 2: INGRESOS (matriz diaria de INGRESOS)
    // ==========================================
    const wsIngresos = wb.addWorksheet(`Ingresos ${monthStr}`, {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    addInstitutionalHeader(wsIngresos, 'INGRESOS DIARIOS POR CATEGORÍA Y CUENTA', matrixColumnCount(incomeMatrix), false);
    const incLayout = renderDailyMatrix(wsIngresos, incomeMatrix, 'INCOME');
    wsIngresos.getColumn(1).width = 14;
    for (let i = 2; i <= incLayout.columnCount; i++) wsIngresos.getColumn(i).width = 15;
    wsIngresos.views = [{ state: 'frozen', xSplit: 1, ySplit: incLayout.headerRow2 }];

    // ==========================================
    // HOJA 3: EGRESOS (matriz diaria de EGRESOS)
    // ==========================================
    const ws2 = wb.addWorksheet(`Egresos ${monthStr}`, {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    addInstitutionalHeader(ws2, 'EGRESOS DIARIOS POR CATEGORÍA Y CUENTA', matrixColumnCount(expenseMatrix), false);
    const expLayout = renderDailyMatrix(ws2, expenseMatrix, 'EXPENSE');
    ws2.getColumn(1).width = 14;
    for (let i = 2; i <= expLayout.columnCount; i++) ws2.getColumn(i).width = 15;
    ws2.views = [{ state: 'frozen', xSplit: 1, ySplit: expLayout.headerRow2 }];

    // ==========================================
    // HOJA 4: TRANSFERENCIAS INTERNAS (matriz diaria SALIDAS | ENTRADAS)
    // ==========================================
    const ws3 = wb.addWorksheet(`Transferencias ${monthStr}`, {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const outSpan = transferOutSide.accounts.length + 1;
    const inSpan = transferInSide.accounts.length + 1;
    const trfColumnCount = 1 + outSpan + inSpan;
    addInstitutionalHeader(ws3, 'TRANSFERENCIAS INTERNAS ENTRE CUENTAS', trfColumnCount, false);

    const trfBlocks = [
      {
        side: transferOutSide,
        label: 'SALIDAS (cuenta origen)',
        totalLabel: 'TOTAL SALIDAS',
        palette: { bg: 'FFFFF3E0', fg: 'FFE65100', subBg: 'FFFFF8E1', subFg: 'FFBF360C', totFg: 'FFE65100' },
      },
      {
        side: transferInSide,
        label: 'ENTRADAS (cuenta destino)',
        totalLabel: 'TOTAL ENTRADAS',
        palette: { bg: 'FFE0F2F1', fg: 'FF00695C', subBg: 'FFE8F5F3', subFg: 'FF00695C', totFg: 'FF00695C' },
      },
    ];

    const trfRow1: any[] = ['Día'];
    const trfRow2: any[] = [''];
    for (const b of trfBlocks) {
      trfRow1.push(b.label);
      for (let i = 0; i < b.side.accounts.length; i++) trfRow1.push('');
      for (const acc of b.side.accounts) trfRow2.push(formatAccountHeader(acc));
      trfRow2.push(b.totalLabel);
    }
    const th1 = ws3.addRow(trfRow1);
    th1.height = 25;
    const th2 = ws3.addRow(trfRow2);
    th2.height = 30;
    ws3.mergeCells(th1.number, 1, th2.number, 1);
    applyHeaderStyle(ws3.getCell(th1.number, 1), 'FFE9ECEF', 'FF495057', true);
    let trfCol = 2;
    for (const b of trfBlocks) {
      const span = b.side.accounts.length + 1;
      if (span > 1) ws3.mergeCells(th1.number, trfCol, th1.number, trfCol + span - 1);
      applyHeaderStyle(ws3.getCell(th1.number, trfCol), b.palette.bg, b.palette.fg, true);
      for (let i = 0; i < span; i++) applyHeaderStyle(ws3.getCell(th2.number, trfCol + i), b.palette.subBg, b.palette.subFg);
      trfCol += span;
    }
    const outTotalCol = 1 + outSpan;
    const inStartCol = outTotalCol + 1;
    const inTotalCol = trfColumnCount;
    const blockSeparator: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: 'FF1F4E79' } };

    const styleTransferRow = (excelRow: ExcelJS.Row) => {
      excelRow.getCell(outTotalCol).font = { color: { argb: trfBlocks[0].palette.totFg }, bold: true };
      excelRow.getCell(inTotalCol).font = { color: { argb: trfBlocks[1].palette.totFg }, bold: true };
      const sepCell = excelRow.getCell(inStartCol);
      sepCell.border = { ...(sepCell.border || {}), left: blockSeparator };
    };
    const sideValues = (side: TransferSide, values: Record<string, number>) =>
      side.accounts.map((acc) => values[acc.id] || 0);

    for (let d = 0; d < daysInMonth; d++) {
      const label = `${String(d + 1).padStart(2, '0')}-${String(query.month).padStart(2, '0')}-${query.year}`;
      const excelRow = ws3.addRow([
        label,
        ...sideValues(transferOutSide, transferOutSide.days[d]),
        transferOutSide.dayTotals[d],
        ...sideValues(transferInSide, transferInSide.days[d]),
        transferInSide.dayTotals[d],
      ]);
      const fill = zebraFill(d + 1);
      excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > 1) cell.numFmt = numFmt;
        cell.border = borderSutil;
        cell.fill = fill;
      });
      styleTransferRow(excelRow);
    }

    const trfTotalRow = ws3.addRow([
      'TOTAL MES',
      ...sideValues(transferOutSide, transferOutSide.totals),
      transferOutSide.grandTotal,
      ...sideValues(transferInSide, transferInSide.totals),
      transferInSide.grandTotal,
    ]);
    trfTotalRow.height = 25;
    trfTotalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { bold: true, name: 'Calibri', size: 11 };
      cell.border = borderTotal;
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'right' };
      if (colNumber > 1) cell.numFmt = numFmt;
      cell.fill = fillTotal;
    });
    styleTransferRow(trfTotalRow);

    ws3.getColumn(1).width = 14;
    for (let i = 2; i <= trfColumnCount; i++) ws3.getColumn(i).width = 16;
    ws3.views = [{ state: 'frozen', xSplit: 1, ySplit: th2.number }];

    return wb;
  }
}
