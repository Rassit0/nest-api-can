import * as ExcelJS from 'exceljs';
import {
  buildFinancialAccountPivot,
  formatAccountHeader,
  renderFinancialAccountPivotTable,
  FinancialAccountColumn,
} from './monthly-accounting-pivot.helper';

describe('monthly-accounting-pivot.helper', () => {
  const CAJA: FinancialAccountColumn = { id: 'acc-caja', name: 'Caja', accountNumber: null };
  const QR: FinancialAccountColumn = { id: 'acc-qr', name: 'QR Escuela y Equipos (FIE)', accountNumber: '123456789' };
  const BISA: FinancialAccountColumn = { id: 'acc-bisa', name: 'Banco BISA', accountNumber: '987654321' };
  const BNB: FinancialAccountColumn = { id: 'acc-bnb', name: 'Banco BNB', accountNumber: '456123789' };
  const allAccounts: FinancialAccountColumn[] = [BISA, BNB, CAJA, QR]; // orden determinista (name asc)

  // Caso E: cuenta con número → nombre + número
  it('Caso E: cuenta con número formatea nombre + Nº número en multilínea', () => {
    const formatted = formatAccountHeader(QR);
    expect(formatted).toBe('QR Escuela y Equipos (FIE)\nNº 123456789');
  });

  // Caso F: cuenta sin número → solo nombre (sin 'Nº -')
  it('Caso F: cuenta sin número formatea únicamente el nombre sin sufijo vacío', () => {
    const formatted = formatAccountHeader(CAJA);
    expect(formatted).toBe('Caja');
    expect(formatted).not.toContain('-');
    expect(formatted).not.toContain('Nº');
  });

  // Caso A: 1 sección, 1 fila, 1 cuenta
  it('Caso A: 1 sección, 1 fila, 1 cuenta genera exactamente 1 columna de cuenta y totales congruentes', () => {
    const pivot = buildFinancialAccountPivot(
      ['Equipos - Basquetbol'],
      { 'Equipos - Basquetbol': [CAJA] },
      { 'Equipos - Basquetbol': { 'acc-caja': 1500 } },
      allAccounts,
    );

    expect(pivot.accounts).toHaveLength(1);
    expect(pivot.accounts[0].name).toBe('Caja');
    expect(pivot.rows).toHaveLength(1);
    expect(pivot.rows[0].label).toBe('Equipos - Basquetbol');
    expect(pivot.rows[0].amountsByAccount['acc-caja']).toBe(1500);
    expect(pivot.rows[0].total).toBe(1500);
    expect(pivot.accountTotals['acc-caja']).toBe(1500);
    expect(pivot.grandTotal).toBe(1500);
  });

  // Caso B: 1 fila, 2 cuentas
  it('Caso B: 1 fila, 2 cuentas distribuye montos y suma fila correctamente', () => {
    const pivot = buildFinancialAccountPivot(
      ['Escuelas - Basquetbol'],
      { 'Escuelas - Basquetbol': [CAJA, QR] },
      { 'Escuelas - Basquetbol': { 'acc-caja': 1000, 'acc-qr': 500 } },
      allAccounts,
    );

    expect(pivot.accounts).toHaveLength(2);
    expect(pivot.rows[0].total).toBe(1500);
    expect(pivot.accountTotals['acc-caja']).toBe(1000);
    expect(pivot.accountTotals['acc-qr']).toBe(500);
    expect(pivot.grandTotal).toBe(1500);
  });

  // Caso C: 2 filas, 2 cuentas
  it('Caso C: 2 filas, 2 cuentas acumula totales horizontales y verticales', () => {
    const pivot = buildFinancialAccountPivot(
      ['Equipos - Basquetbol', 'Equipos - Voleibol'],
      {
        'Equipos - Basquetbol': [CAJA, QR],
        'Equipos - Voleibol': [CAJA, QR],
      },
      {
        'Equipos - Basquetbol': { 'acc-caja': 26755, 'acc-qr': 9250 },
        'Equipos - Voleibol': { 'acc-caja': 4577, 'acc-qr': 3340 },
      },
      allAccounts,
    );

    expect(pivot.rows).toHaveLength(2);
    expect(pivot.rows[0].total).toBe(26755 + 9250);
    expect(pivot.rows[1].total).toBe(4577 + 3340);
    expect(pivot.accountTotals['acc-caja']).toBe(26755 + 4577);
    expect(pivot.accountTotals['acc-qr']).toBe(9250 + 3340);
    expect(pivot.grandTotal).toBe(26755 + 9250 + 4577 + 3340);
  });

  // Caso D: cuenta ausente en una fila → internal 0, visual —
  it('Caso D: cuenta ausente en una fila tiene valor interno 0', () => {
    const pivot = buildFinancialAccountPivot(
      ['GIMNASIO', 'OTROS'],
      {
        GIMNASIO: [QR], // solo QR
        OTROS: [CAJA, QR], // Caja y QR
      },
      {
        GIMNASIO: { 'acc-qr': 500 },
        OTROS: { 'acc-caja': 10310, 'acc-qr': 830 },
      },
      allAccounts,
    );

    expect(pivot.accounts).toHaveLength(2); // Caja y QR
    const gimRow = pivot.rows.find((r) => r.label === 'GIMNASIO')!;
    expect(gimRow.amountsByAccount['acc-caja']).toBe(0); // internal 0
    expect(gimRow.amountsByAccount['acc-qr']).toBe(500);
    expect(gimRow.total).toBe(500);
  });

  // Caso G: 3+ cuentas dinámicas → columnas automáticas en orden determinista
  it('Caso G: 3+ cuentas dinámicas generan columnas en orden determinista (según allAccounts)', () => {
    const pivot = buildFinancialAccountPivot(
      ['Cat A', 'Cat B'],
      {
        'Cat A': [CAJA, BNB, BISA],
        'Cat B': [QR, CAJA],
      },
      {
        'Cat A': { 'acc-caja': 10, 'acc-bnb': 20, 'acc-bisa': 30 },
        'Cat B': { 'acc-qr': 40, 'acc-caja': 50 },
      },
      allAccounts, // [BISA, BNB, CAJA, QR]
    );

    expect(pivot.accounts.map((a) => a.id)).toEqual(['acc-bisa', 'acc-bnb', 'acc-caja', 'acc-qr']);
  });

  // Caso H: totales: Σ rows = Σ columns = grand total (Triple invariante)
  it('Caso H: se cumple estrictamente el triple invariante de totales', () => {
    const pivot = buildFinancialAccountPivot(
      ['Fila 1', 'Fila 2', 'Fila 3'],
      {
        'Fila 1': [CAJA, QR],
        'Fila 2': [BNB, QR],
        'Fila 3': [CAJA, BISA],
      },
      {
        'Fila 1': { 'acc-caja': 100.25, 'acc-qr': 50.75 },
        'Fila 2': { 'acc-bnb': 200.1, 'acc-qr': 80.4 },
        'Fila 3': { 'acc-caja': 30.5, 'acc-bisa': 70.0 },
      },
      allAccounts,
    );

    const sumRows = pivot.rows.reduce((s, r) => s + r.total, 0);
    const sumCols = Object.values(pivot.accountTotals).reduce((s, v) => s + v, 0);

    expect(sumRows).toBeCloseTo(pivot.grandTotal, 4);
    expect(sumCols).toBeCloseTo(pivot.grandTotal, 4);
    expect(sumRows).toBeCloseTo(sumCols, 4);
  });

  // Caso I: movimiento no duplicado (suma exacta de montos pasados)
  it('Caso I: una operación no duplica movimientos en la matriz ni en totales', () => {
    const pivot = buildFinancialAccountPivot(
      ['PASANAKU'],
      { PASANAKU: [CAJA] },
      { PASANAKU: { 'acc-caja': 4000 } },
      allAccounts,
    );

    expect(pivot.rows[0].amountsByAccount['acc-caja']).toBe(4000);
    expect(pivot.grandTotal).toBe(4000);
  });

  // Caso J: segunda sección del Resumen (EGRESOS) usa el mismo builder correctamente
  it('Caso J: la sección de egresos usa exactamente el mismo builder produciendo su propia estructura', () => {
    const expPivot = buildFinancialAccountPivot(
      ['ARBITRAJE', 'SEGURO'],
      {
        ARBITRAJE: [QR],
        SEGURO: [CAJA],
      },
      {
        ARBITRAJE: { 'acc-qr': 25 },
        SEGURO: { 'acc-caja': 50 },
      },
      allAccounts,
    );

    expect(expPivot.accounts.map((a) => a.id)).toEqual(['acc-caja', 'acc-qr']);
    expect(expPivot.rows[0].amountsByAccount['acc-caja']).toBe(0);
    expect(expPivot.rows[0].amountsByAccount['acc-qr']).toBe(25);
    expect(expPivot.rows[1].amountsByAccount['acc-caja']).toBe(50);
    expect(expPivot.rows[1].amountsByAccount['acc-qr']).toBe(0);
    expect(expPivot.grandTotal).toBe(75);
  });

  // Test del renderizador con ExcelJS
  it('renderFinancialAccountPivotTable genera la cuadrícula con bordes, numFmt y cabeceras dinámicas', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Resumen Test');

    const pivot = buildFinancialAccountPivot(
      ['Cat A', 'Cat B'],
      {
        'Cat A': [CAJA, QR],
        'Cat B': [CAJA, QR],
      },
      {
        'Cat A': { 'acc-caja': 100, 'acc-qr': 0 },
        'Cat B': { 'acc-caja': 0, 'acc-qr': 200 },
      },
      allAccounts,
    );

    const result = renderFinancialAccountPivotTable({
      ws,
      sectionTitle: '(1) INGRESOS EXTERNOS',
      sectionHeaderColor: 'FF2E7D32',
      colHeaderBg: 'FFE8F5E9',
      colHeaderFg: 'FF1B5E20',
      firstColHeader: 'Categoría / Disciplina',
      totalLabel: 'TOTAL INGRESOS EXTERNOS',
      totalRowColor: 'FF2E7D32',
      data: pivot,
      zebraFill: () => ({ type: 'pattern', pattern: 'none' }),
      borderSutil: { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } },
      borderTotal: { top: { style: 'medium', color: { argb: 'FF1F4E79' } } },
      fillTotal: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } },
    });

    expect(result.columnCount).toBe(4); // Concepto + 2 Cuentas + TOTAL
    // Fila de encabezado de columnas
    const colH = ws.getRow(result.headerRow);
    expect(colH.getCell(1).value).toBe('Categoría / Disciplina');
    expect(colH.getCell(2).value).toBe('Caja');
    expect(colH.getCell(3).value).toBe('QR Escuela y Equipos (FIE)\nNº 123456789');
    expect(colH.getCell(4).value).toBe('TOTAL');

    // Fila Cat A
    const rCatA = ws.getRow(result.headerRow + 1);
    expect(rCatA.getCell(1).value).toBe('Cat A');
    expect(rCatA.getCell(2).value).toBe(100);
    expect(rCatA.getCell(3).value).toBe(0); // internal 0
    expect(rCatA.getCell(3).numFmt).toBe('#,##0.00;-#,##0.00;"—"'); // visual —
    expect(rCatA.getCell(4).value).toBe(100);

    // Fila total
    const rTot = ws.getRow(result.totalRow);
    expect(rTot.getCell(1).value).toBe('TOTAL INGRESOS EXTERNOS');
    expect(rTot.getCell(2).value).toBe(100);
    expect(rTot.getCell(3).value).toBe(200);
    expect(rTot.getCell(4).value).toBe(300);
  });
});
