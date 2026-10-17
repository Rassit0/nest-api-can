import * as ExcelJS from 'exceljs';

export interface FinancialAccountColumn {
  id: string;
  name: string;
  accountNumber?: string | null;
}

export interface PivotRow {
  label: string;
  amountsByAccount: Record<string, number>;
  total: number;
}

export interface PivotTableData {
  accounts: FinancialAccountColumn[];
  rows: PivotRow[];
  accountTotals: Record<string, number>;
  grandTotal: number;
}

export interface PivotTableRenderOptions {
  ws: ExcelJS.Worksheet;
  sectionTitle: string;
  sectionHeaderColor: string; // argb, e.g. 'FF2E7D32'
  colHeaderBg: string; // argb, e.g. 'FFE8F5E9'
  colHeaderFg: string; // argb, e.g. 'FF1B5E20'
  firstColHeader: string; // e.g. 'Categoría / Disciplina'
  totalLabel: string; // e.g. 'TOTAL INGRESOS EXTERNOS'
  totalRowColor: string; // argb, e.g. 'FF2E7D32'
  data: PivotTableData;
  numFmt?: string;
  zebraFill: (i: number) => ExcelJS.Fill;
  borderSutil: Partial<ExcelJS.Borders>;
  borderTotal: Partial<ExcelJS.Borders>;
  fillTotal: ExcelJS.Fill;
}

/**
 * Formatea el encabezado de una columna de cuenta financiera.
 * Si tiene número: Nombre\nNº 123456
 * Si no tiene número: Nombre
 * Nunca muestra 'Nº -' ni crea columnas separadas.
 */
export function formatAccountHeader(acc: { name: string; accountNumber?: string | null }): string {
  const num = acc.accountNumber?.trim();
  return num ? `${acc.name}\nNº ${num}` : acc.name;
}

/**
 * Construye la matriz pivot (Categoría × Cuenta Financiera)
 * - Muestra únicamente cuentas con movimiento dentro de ESA sección.
 * - Mantiene el orden determinista de `allAccounts`.
 * - Garantiza el triple invariante: Σ rowTotal = Σ accountTotals = grandTotal.
 * - Asigna 0 a combinaciones sin movimiento.
 */
export function buildFinancialAccountPivot(
  categories: string[],
  activeAccountsMap: Record<string, FinancialAccountColumn[]>,
  totalsMap: Record<string, Record<string, number>>,
  allAccounts: FinancialAccountColumn[],
): PivotTableData {
  // 1. Identificar cuentas que tienen al menos un movimiento en esta sección
  const sectionAccountIds = new Set<string>();
  for (const cat of categories) {
    const accs = activeAccountsMap[cat] || [];
    for (const acc of accs) {
      if (Math.abs(totalsMap[cat]?.[acc.id] || 0) > 0) {
        sectionAccountIds.add(acc.id);
      }
    }
  }

  // 2. Orden determinista consistente (según lista global de cuentas)
  const sectionAccounts = allAccounts.filter((a) => sectionAccountIds.has(a.id));

  // 3. Inicializar acumuladores por cuenta y gran total
  const accountTotals: Record<string, number> = {};
  for (const acc of sectionAccounts) {
    accountTotals[acc.id] = 0;
  }
  let grandTotal = 0;

  // 4. Construir filas por categoría
  const rows: PivotRow[] = [];
  for (const cat of categories) {
    const amountsByAccount: Record<string, number> = {};
    let rowTotal = 0;

    for (const acc of sectionAccounts) {
      const amt = totalsMap[cat]?.[acc.id] || 0;
      amountsByAccount[acc.id] = amt;
      rowTotal += amt;
      accountTotals[acc.id] += amt;
    }

    grandTotal += rowTotal;
    rows.push({
      label: cat,
      amountsByAccount,
      total: rowTotal,
    });
  }

  return {
    accounts: sectionAccounts,
    rows,
    accountTotals,
    grandTotal,
  };
}

/**
 * Renderiza la tabla matricial pivot en la hoja de Excel.
 * - Cabecera de sección unificada (merge a lo ancho de la tabla).
 * - Cabecera de columnas dinámica: Concepto | Cuenta 1 | Cuenta 2 | ... | TOTAL
 * - Celdas de datos con valor interno 0 y formato visual '—' (#,##0.00;-#,##0.00;"—")
 * - Fila final con totales por cuenta y total general destacado.
 * - Bordes visibles en toda la cuadrícula para facilitar la lectura.
 */
export function renderFinancialAccountPivotTable(options: PivotTableRenderOptions): {
  headerRow: number;
  totalRow: number;
  columnCount: number;
} {
  const {
    ws,
    sectionTitle,
    sectionHeaderColor,
    colHeaderBg,
    colHeaderFg,
    firstColHeader,
    totalLabel,
    totalRowColor,
    data,
    zebraFill,
    borderSutil,
    borderTotal,
    fillTotal,
  } = options;

  const numFmt = options.numFmt || '#,##0.00;-#,##0.00;"—"';
  const totalNumFmt = '#,##0.00';
  const columnCount = Math.max(data.accounts.length + 2, 2);

  // Bordes sutiles para asegurar que las filas y columnas se sigan visualmente
  const borderGrid: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  };

  // 1. Banner de la sección
  const secHeader = ws.addRow([sectionTitle]);
  if (columnCount > 1) {
    ws.mergeCells(secHeader.number, 1, secHeader.number, columnCount);
  }
  secHeader.height = 24;
  secHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sectionHeaderColor } };
  secHeader.getCell(1).font = { name: 'Calibri', color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
  secHeader.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  // 2. Cabecera de columnas
  const colHeaderValues: any[] = [
    firstColHeader,
    ...data.accounts.map(formatAccountHeader),
    'TOTAL',
  ];
  const colHeaderRow = ws.addRow(colHeaderValues);
  colHeaderRow.height = 32;
  colHeaderRow.eachCell({ includeEmpty: true }, (c, col) => {
    if (col <= columnCount) {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colHeaderBg } };
      c.font = { name: 'Calibri', color: { argb: colHeaderFg }, bold: true, size: 10 };
      c.border = borderSutil;
      c.alignment = {
        vertical: 'middle',
        horizontal: col === 1 ? 'left' : col === columnCount ? 'right' : 'center',
        wrapText: true,
      };
    }
  });

  // 3. Filas de datos (una por categoría/concepto)
  if (data.rows.length === 0) {
    const emptyRow = ws.addRow(['Sin movimientos en el período', ...data.accounts.map(() => 0), 0]);
    emptyRow.height = 20;
    emptyRow.eachCell({ includeEmpty: true }, (c, col) => {
      if (col <= columnCount) {
        c.border = borderGrid;
        c.font = { name: 'Calibri', size: 10, italic: true };
        c.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right' };
        if (col > 1) c.numFmt = numFmt;
      }
    });
  } else {
    data.rows.forEach((row, rIdx) => {
      const rowValues: any[] = [
        row.label,
        ...data.accounts.map((acc) => row.amountsByAccount[acc.id] || 0),
        row.total,
      ];
      const dRow = ws.addRow(rowValues);
      dRow.height = 20;
      const fill = zebraFill(rIdx + 1);

      dRow.eachCell({ includeEmpty: true }, (c, col) => {
        if (col <= columnCount) {
          c.border = borderGrid;
          c.fill = fill;
          if (col === 1) {
            c.font = { name: 'Calibri', size: 10 };
            c.alignment = { vertical: 'middle', horizontal: 'left' };
          } else if (col === columnCount) {
            c.font = { name: 'Calibri', size: 10, bold: true };
            c.alignment = { vertical: 'middle', horizontal: 'right' };
            c.numFmt = totalNumFmt;
          } else {
            c.font = { name: 'Calibri', size: 10 };
            c.alignment = { vertical: 'middle', horizontal: 'right' };
            c.numFmt = numFmt;
          }
        }
      });
    });
  }

  // 4. Fila de Total de Sección
  const totalRowValues: any[] = [
    totalLabel,
    ...data.accounts.map((acc) => data.accountTotals[acc.id] || 0),
    data.grandTotal,
  ];
  const tRow = ws.addRow(totalRowValues);
  tRow.height = 22;
  tRow.eachCell({ includeEmpty: true }, (c, col) => {
    if (col <= columnCount) {
      c.fill = fillTotal;
      c.border = borderTotal;
      c.font = { name: 'Calibri', bold: true, size: 11, color: { argb: totalRowColor } };
      c.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right' };
      if (col > 1) c.numFmt = totalNumFmt;
    }
  });

  return {
    headerRow: colHeaderRow.number,
    totalRow: tRow.number,
    columnCount,
  };
}
