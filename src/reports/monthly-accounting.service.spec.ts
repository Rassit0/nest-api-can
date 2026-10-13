import { Test, TestingModule } from '@nestjs/testing';
import * as ExcelJS from 'exceljs';
import { MonthlyAccountingService } from './monthly-accounting.service';
import { PrismaService } from '../prisma.service';
import { TransactionStatus, TransferStatus } from '../generated/prisma/client';
import { MonthlyAccountingExcelService } from './monthly-accounting-excel.service';
import { envs } from '../config/envs';

const ACCOUNTS = [
  { id: 'acc1', name: 'Caja', type: 'CASH', isActive: true, accountNumber: null },
  { id: 'acc2', name: 'QR SOL', type: 'BANK', isActive: true, accountNumber: '123-456' },
];

const schoolCharge = (discipline: string) => ({
  studentCharges: [
    { studentMembership: { courseSeason: { course: { school: { discipline: { name: discipline } } } } } },
  ],
  membershipCharges: [],
});
const categoryCharge = (name: string) => ({
  studentCharges: [],
  membershipCharges: [],
  accountCharge: { category: { name } },
});

let seq = 0;
const tx = (o: {
  date: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  acc: 'acc1' | 'acc2';
  charge?: any;
  status?: TransactionStatus;
  isInternalTransfer?: boolean;
}) => ({
  id: `tx-${++seq}`,
  transactionDate: new Date(o.date),
  amount: o.amount,
  type: o.type,
  status: o.status ?? TransactionStatus.COMPLETED,
  financialAccountId: o.acc,
  financialAccount: ACCOUNTS.find((a) => a.id === o.acc),
  isInternalTransfer: o.isInternalTransfer ?? false,
  reversedBy: null,
  payment: o.charge ? { charge: o.charge } : null,
});

const transfer = (o: { id: string; n: number; amount: number; status?: TransferStatus; src: any; dst: any; date?: string }) => ({
  id: o.id,
  date: new Date(o.date ?? '2026-10-12T16:00:00Z'),
  receiptSeries: 'TRF',
  receiptNumber: o.n,
  reference: null,
  description: 'Traspaso',
  amount: o.amount,
  status: o.status ?? TransferStatus.COMPLETED,
  sourceTransaction: { financialAccountId: o.src.acc, financialAccount: { name: o.src.name }, ...o.src.bal },
  destinationTransaction: { financialAccountId: o.dst.acc, financialAccount: { name: o.dst.name }, ...o.dst.bal },
});
const CAJA = { acc: 'acc1', name: 'Caja' };
const QR = { acc: 'acc2', name: 'QR SOL' };

/** Busca la fila cuyo valor en col 1 coincide */
const findRow = (ws: ExcelJS.Worksheet, label: string) => {
  let found: ExcelJS.Row | undefined;
  ws.eachRow((r) => {
    if (!found && r.getCell(1).value === label) found = r;
  });
  return found;
};
/** Fila de cabecera de la matriz (col 1 = 'Día') */
const matrixHeader = (ws: ExcelJS.Worksheet) => findRow(ws, 'Día')!;
const dayRows = (ws: ExcelJS.Worksheet, month = 10, year = 2026) => {
  const re = new RegExp(`^\\d{2}-${String(month).padStart(2, '0')}-${year}$`);
  const rows: ExcelJS.Row[] = [];
  ws.eachRow((r) => {
    const v = r.getCell(1).value;
    if (typeof v === 'string' && re.test(v)) rows.push(r);
  });
  return rows;
};
const lastCol = (r: ExcelJS.Row) => r.cellCount;

describe('MonthlyAccountingExcelService — matriz diaria', () => {
  let service: MonthlyAccountingService;
  let excelService: MonthlyAccountingExcelService;

  const mockPrisma = {
    financialAccount: { findMany: jest.fn() },
    transaction: { groupBy: jest.fn(), findMany: jest.fn() },
    internalTransfer: { findMany: jest.fn() },
  };

  const setup = (opts: { opening?: any[]; txs?: any[]; transfers?: any[] }) => {
    mockPrisma.financialAccount.findMany.mockResolvedValue(ACCOUNTS);
    mockPrisma.transaction.groupBy.mockResolvedValue(opts.opening ?? []);
    mockPrisma.transaction.findMany.mockResolvedValue(opts.txs ?? []);
    mockPrisma.internalTransfer.findMany.mockImplementation(async (args?: any) => {
      if (args?.where?.date?.gte) {
        // período: filtra por status igual que Prisma en DB
        const all = opts.transfers ?? [];
        if (args?.where?.status) {
          return all.filter((t: any) => t.status === args.where.status);
        }
        return all;
      }
      // históricas
      return [];
    });
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonthlyAccountingService,
        MonthlyAccountingExcelService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(MonthlyAccountingService);
    excelService = module.get(MonthlyAccountingExcelService);
  });

  const scenario = () => {
    const txs = [
      // Día 5: dos ingresos misma categoría/cuenta + uno en otra cuenta
      tx({ date: '2026-10-05T14:00:00Z', amount: 100, type: 'INCOME', acc: 'acc1', charge: schoolCharge('Básquet') }),
      tx({ date: '2026-10-05T18:00:00Z', amount: 50, type: 'INCOME', acc: 'acc1', charge: schoolCharge('Básquet') }),
      tx({ date: '2026-10-05T19:00:00Z', amount: 30, type: 'INCOME', acc: 'acc2', charge: schoolCharge('Básquet') }),
      // Día 6: otra categoría
      tx({ date: '2026-10-06T15:00:00Z', amount: 200, type: 'INCOME', acc: 'acc2', charge: schoolCharge('Voleibol') }),
      // Ingreso CANCELLED sin reversión: no cuenta
      tx({ date: '2026-10-06T16:00:00Z', amount: 999, type: 'INCOME', acc: 'acc1', charge: schoolCharge('Voleibol'), status: TransactionStatus.CANCELLED }),
      // Egresos
      tx({ date: '2026-10-07T15:00:00Z', amount: 40, type: 'EXPENSE', acc: 'acc1', charge: categoryCharge('SEGURO') }),
      tx({ date: '2026-10-07T17:00:00Z', amount: 10, type: 'EXPENSE', acc: 'acc1', charge: categoryCharge('SEGURO') }),
      tx({ date: '2026-10-09T15:00:00Z', amount: 25, type: 'EXPENSE', acc: 'acc2', charge: categoryCharge('ARBITRAJE') }),
    ];
    const transfers = [
      transfer({
        id: 'it-1', n: 15, amount: 300,
        src: { acc: 'acc1', name: 'Caja', bal: { balanceBefore: 1170, balanceAfter: 870 } },
        dst: { acc: 'acc2', name: 'QR SOL', bal: { balanceBefore: 2000, balanceAfter: 2300 } },
      }),
      transfer({
        id: 'it-2', n: 16, amount: 500, status: TransferStatus.CANCELLED,
        src: { acc: 'acc2', name: 'QR SOL', bal: { balanceBefore: 2300, balanceAfter: 2300 } },
        dst: { acc: 'acc1', name: 'Caja', bal: { balanceBefore: 870, balanceAfter: 870 } },
      }),
    ];
    const opening = [
      { financialAccountId: 'acc1', type: 'INCOME', _sum: { amount: 1000 } },
      { financialAccountId: 'acc2', type: 'INCOME', _sum: { amount: 2000 } },
    ];
    setup({ opening, txs, transfers });
  };

  it('workbook tiene exactamente 3 hojas: Resumen, Egresos, Transferencias', async () => {
    scenario();
    const wb = await excelService.generateExcel({ year: 2026, month: 10 });
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Resumen 2026-10',
      'Egresos 2026-10',
      'Transferencias 2026-10',
    ]);
  });

  it('1-6. RESUMEN: una fila por día, agregación diaria, categorías × cuentas, totales diario y mensual', async () => {
    scenario();
    const wb = await excelService.generateExcel({ year: 2026, month: 10 });
    const ws = wb.getWorksheet('Resumen 2026-10')!;

    // 1. Una fila por día (31), no por recibo
    const days = dayRows(ws);
    expect(days).toHaveLength(31);

    // 3-4. Cabeceras: categorías y cuentas reales
    const h1 = matrixHeader(ws);
    const h2 = ws.getRow(h1.number + 1);
    expect(h1.getCell(2).value).toBe('Escuelas - Básquet');
    expect(h2.getCell(2).value).toBe('Caja');
    expect(h2.getCell(3).value).toBe('QR SOL\nNº 123-456');
    expect(h2.getCell(4).value).toBe('TOTAL');
    expect(h1.getCell(5).value).toBe('Escuelas - Voleibol');
    expect(h2.getCell(5).value).toBe('QR SOL\nNº 123-456'); // Caja sin movimiento efectivo → no se muestra
    expect(h2.getCell(6).value).toBe('TOTAL');
    expect(h1.getCell(7).value).toBe('TOTAL INGRESOS');

    // 2. Dos ingresos del mismo día/cuenta agregados
    const d5 = findRow(ws, '05-10-2026')!;
    expect(d5.getCell(2).value).toBe(150);
    expect(d5.getCell(3).value).toBe(30);
    expect(d5.getCell(4).value).toBe(180);
    // 5. Total diario
    expect(d5.getCell(7).value).toBe(180);
    const d6 = findRow(ws, '06-10-2026')!;
    expect(d6.getCell(7).value).toBe(200); // CANCELLED excluido (13)

    // 6. Total mensual
    const total = findRow(ws, 'TOTAL MES')!;
    expect(total.getCell(2).value).toBe(150);
    expect(total.getCell(4).value).toBe(180);
    expect(total.getCell(6).value).toBe(200);
    expect(total.getCell(7).value).toBe(380);
  });

  it('RESUMEN no contiene egresos ni transferencias', async () => {
    scenario();
    const wb = await excelService.generateExcel({ year: 2026, month: 10 });
    const ws = wb.getWorksheet('Resumen 2026-10')!;
    const h1 = matrixHeader(ws);
    const labels = (h1.values as any[]).filter(Boolean);
    expect(labels).not.toContain('TOTAL EGRESOS');
    expect(labels).not.toContain('SEGURO');
    expect(labels).not.toContain('ENTRADAS INTERNAS');
    expect(labels).not.toContain('NETO OPERATIVO');
    expect(lastCol(h1)).toBe(7);
  });

  it('7-8. EGRESOS: una fila por día, categorías × cuentas, totales diario y mensual', async () => {
    scenario();
    const wb = await excelService.generateExcel({ year: 2026, month: 10 });
    const ws = wb.getWorksheet('Egresos 2026-10')!;
    expect(dayRows(ws)).toHaveLength(31);

    const h1 = matrixHeader(ws);
    const h2 = ws.getRow(h1.number + 1);
    expect(h1.getCell(2).value).toBe('ARBITRAJE');
    expect(h2.getCell(2).value).toBe('QR SOL\nNº 123-456');
    expect(h1.getCell(4).value).toBe('SEGURO');
    expect(h2.getCell(4).value).toBe('Caja');
    expect(h1.getCell(6).value).toBe('TOTAL EGRESOS');

    const d7 = findRow(ws, '07-10-2026')!;
    expect(d7.getCell(4).value).toBe(50);
    expect(d7.getCell(6).value).toBe(50);
    const total = findRow(ws, 'TOTAL MES')!;
    expect(total.getCell(6).value).toBe(75);
  });

  it('InternalTransfer no aparece en la matriz diaria de Resumen ni de Egresos', async () => {
    scenario();
    const wb = await excelService.generateExcel({ year: 2026, month: 10 });
    for (const name of ['Resumen 2026-10', 'Egresos 2026-10']) {
      const ws = wb.getWorksheet(name)!;
      let inMatrix = false;
      ws.eachRow((r) => {
        const v = r.getCell(1).value;
        if (v === 'Día') inMatrix = true;
        if (inMatrix) {
          (r.values as any[]).forEach((val) => expect(String(val ?? '')).not.toMatch(/TRF-|SALIDAS|ENTRADAS/));
        }
        if (v === 'TOTAL MES') inMatrix = false;
      });
      expect(findRow(ws, 'TOTAL MES')!.getCell(2).value).not.toBe(300);
    }
  });

  // --- MATRIZ DIARIA DE TRANSFERENCIAS ---
  // Columnas esperadas cuando ambas cuentas actúan en ambos roles:
  // 1 Día | 2 Caja(out) | 3 QR(out) | 4 TOTAL SALIDAS | 5 Caja(in) | 6 QR(in) | 7 TOTAL ENTRADAS
  const transferScenario = () =>
    setup({
      transfers: [
        // Día 3: dos salidas de Caja hacia QR (se suman) + una de QR hacia Caja
        transfer({ id: 't-a', n: 1, amount: 100, src: CAJA, dst: QR, date: '2026-10-03T14:00:00Z' }),
        transfer({ id: 't-b', n: 2, amount: 50, src: CAJA, dst: QR, date: '2026-10-03T18:00:00Z' }),
        transfer({ id: 't-c', n: 3, amount: 70, src: QR, dst: CAJA, date: '2026-10-03T20:00:00Z' }),
        // CANCELLED: no debe aparecer ni sumar
        transfer({ id: 't-d', n: 4, amount: 999, src: CAJA, dst: QR, date: '2026-10-03T21:00:00Z', status: TransferStatus.CANCELLED }),
        // 2026-10-11T02:00Z = 10/10 22:00 en La Paz → fila día 10
        transfer({ id: 't-e', n: 5, amount: 40, src: QR, dst: CAJA, date: '2026-10-11T02:00:00Z' }),
      ],
    });

  it('T1/T3/T13. Transferencias: una fila por día calendario (31 en octubre), no por transferencia', async () => {
    transferScenario();
    const wb = await excelService.generateExcel({ year: 2026, month: 10 });
    const ws = wb.getWorksheet('Transferencias 2026-10')!;
    expect(dayRows(ws)).toHaveLength(31);
    ws.eachRow((r) => (r.values as any[]).forEach((v) => expect(String(v ?? '')).not.toMatch(/TRF-/)));
    // Sin columnas operativas de detalle
    const h2 = ws.getRow(matrixHeader(ws).number + 1);
    const labels = (h2.values as any[]).filter(Boolean);
    for (const l of ['Recibo TRF', 'Estado', 'Saldo Ant. Origen', 'Saldo Nuevo Destino']) expect(labels).not.toContain(l);
  });

  it('T2. Septiembre produce 30 filas calendario', async () => {
    setup({ transfers: [transfer({ id: 's1', n: 1, amount: 10, src: CAJA, dst: QR, date: '2026-09-15T15:00:00Z' })] });
    const wb = await excelService.generateExcel({ year: 2026, month: 9 });
    const ws = wb.getWorksheet('Transferencias 2026-09')!;
    expect(dayRows(ws, 9)).toHaveLength(30);
    expect(findRow(ws, '15-09-2026')!.getCell(2).value).toBe(10);
  });

  it('T4-T5. Cabeceras: SALIDAS (cuentas origen) a la izquierda, ENTRADAS (cuentas destino) a la derecha', async () => {
    transferScenario();
    const wb = await excelService.generateExcel({ year: 2026, month: 10 });
    const ws = wb.getWorksheet('Transferencias 2026-10')!;
    const h1 = matrixHeader(ws);
    const h2 = ws.getRow(h1.number + 1);
    expect(h1.getCell(2).value).toBe('SALIDAS (cuenta origen)');
    expect(h1.getCell(5).value).toBe('ENTRADAS (cuenta destino)');
    expect([2, 3, 4, 5, 6, 7].map((c) => h2.getCell(c).value)).toEqual([
      'Caja', 'QR SOL\nNº 123-456', 'TOTAL SALIDAS', 'Caja', 'QR SOL\nNº 123-456', 'TOTAL ENTRADAS',
    ]);
    expect(lastCol(h2)).toBe(7);
  });

  it('T4-T7/T9. Agregación diaria por cuenta origen/destino y Total Salidas = Total Entradas', async () => {
    transferScenario();
    const wb = await excelService.generateExcel({ year: 2026, month: 10 });
    const ws = wb.getWorksheet('Transferencias 2026-10')!;
    const d3 = findRow(ws, '03-10-2026')!;
    // SALIDAS: Caja 100+50, QR 70
    expect(d3.getCell(2).value).toBe(150);
    expect(d3.getCell(3).value).toBe(70);
    expect(d3.getCell(4).value).toBe(220);
    // ENTRADAS: Caja 70, QR 100+50
    expect(d3.getCell(5).value).toBe(70);
    expect(d3.getCell(6).value).toBe(150);
    expect(d3.getCell(7).value).toBe(220);
    for (const r of dayRows(ws)) expect(Number(r.getCell(4).value) - Number(r.getCell(7).value)).toBe(0);
    // Día sin transferencias: fila presente con ceros
    expect([2, 3, 4, 5, 6, 7].map((c) => findRow(ws, '20-10-2026')!.getCell(c).value)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('T8. CANCELLED no aparece ni suma (ni crea columnas)', async () => {
    transferScenario();
    const wb = await excelService.generateExcel({ year: 2026, month: 10 });
    const ws = wb.getWorksheet('Transferencias 2026-10')!;
    ws.eachRow((r) => (r.values as any[]).forEach((v) => {
      expect(v).not.toBe(999);
      expect(String(v ?? '')).not.toMatch(/CANCELLED|ANULAD/i);
    }));

    // Escenario general: el único CANCELLED es QR→Caja; si se filtrara, aparecería QR en SALIDAS
    jest.resetAllMocks();
    scenario();
    const wb2 = await excelService.generateExcel({ year: 2026, month: 10 });
    const ws2 = wb2.getWorksheet('Transferencias 2026-10')!;
    const h2 = ws2.getRow(matrixHeader(ws2).number + 1);
    expect([2, 3, 4, 5].map((c) => h2.getCell(c).value)).toEqual(['Caja', 'TOTAL SALIDAS', 'QR SOL\nNº 123-456', 'TOTAL ENTRADAS']);
    const total = findRow(ws2, 'TOTAL MES')!;
    expect(total.getCell(3).value).toBe(300);
    expect(total.getCell(5).value).toBe(300);
  });

  it('T10-T11. Total mensual: Salidas = Entradas por cuenta y global; neto 0', async () => {
    transferScenario();
    const wb = await excelService.generateExcel({ year: 2026, month: 10 });
    const ws = wb.getWorksheet('Transferencias 2026-10')!;
    const total = findRow(ws, 'TOTAL MES')!;
    // SALIDAS: Caja 150, QR 70+40 ; ENTRADAS: Caja 70+40, QR 150
    expect([2, 3, 4, 5, 6, 7].map((c) => total.getCell(c).value)).toEqual([150, 110, 260, 110, 150, 260]);
    expect(Number(total.getCell(4).value) - Number(total.getCell(7).value)).toBe(0);
    const tot = findRow(wb.getWorksheet('Resumen 2026-10')!, 'TOTAL GENERAL')!;
    expect(tot.getCell(6).value).toBe(260);
    expect(tot.getCell(7).value).toBe(-260);
  });

  it('T12. Transferencias: el día respeta envs.appTimezone', async () => {
    const original = envs.appTimezone;
    envs.appTimezone = 'America/La_Paz';
    try {
      transferScenario();
      const wb = await excelService.generateExcel({ year: 2026, month: 10 });
      const ws = wb.getWorksheet('Transferencias 2026-10')!;
      // t-e (QR→Caja, 40) a las 2026-10-11T02:00Z pertenece al 10/10 local
      expect(findRow(ws, '10-10-2026')!.getCell(3).value).toBe(40);
      expect(findRow(ws, '10-10-2026')!.getCell(5).value).toBe(40);
      expect(findRow(ws, '11-10-2026')!.getCell(4).value).toBe(0);
    } finally {
      envs.appTimezone = original;
    }
  });

  it('14. APP_TIMEZONE: transacción nocturna se agrupa en el día civil local', async () => {
    const original = envs.appTimezone;
    envs.appTimezone = 'America/La_Paz';
    try {
      setup({
        txs: [
          // 2026-10-04T02:00Z = 03/10 22:00 en La Paz
          tx({ date: '2026-10-04T02:00:00Z', amount: 77, type: 'INCOME', acc: 'acc1', charge: schoolCharge('Básquet') }),
        ],
      });
      const wb = await excelService.generateExcel({ year: 2026, month: 10 });
      const ws = wb.getWorksheet('Resumen 2026-10')!;
      const h1 = matrixHeader(ws);
      const totalCol = lastCol(h1);
      expect(findRow(ws, '03-10-2026')!.getCell(totalCol).value).toBe(77);
      expect(findRow(ws, '04-10-2026')!.getCell(totalCol).value).toBe(0);
    } finally {
      envs.appTimezone = original;
    }
  });

  it('14b. Límites de mes consultados en UTC derivados de envs.appTimezone', async () => {
    setup({});
    await service.getAccountingData({ year: 2026, month: 10 });
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          transactionDate: {
            gte: new Date('2026-10-01T04:00:00.000Z'),
            lt: new Date('2026-11-01T04:00:00.000Z'),
          },
        }),
      }),
    );
  });

  it('14c. MonthlyAccountingService consulta transferencias del período exigiendo status: TransferStatus.COMPLETED y excluye CANCELLED', async () => {
    const legacyCompleted = transfer({
      id: 'it-leg', n: 10, amount: 100,
      src: CAJA, dst: QR,
    });
    // Legacy completed sin recibo
    (legacyCompleted as any).receiptSeries = null;
    (legacyCompleted as any).receiptNumber = null;

    const cancelledTransfer = transfer({
      id: 'it-canc', n: 11, amount: 200, status: TransferStatus.CANCELLED,
      src: CAJA, dst: QR,
    });

    setup({ transfers: [legacyCompleted, cancelledTransfer] });
    const result = await service.getAccountingData({ year: 2026, month: 10 });

    expect(mockPrisma.internalTransfer.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: expect.objectContaining({
            gte: new Date('2026-10-01T04:00:00.000Z'),
            lt: new Date('2026-11-01T04:00:00.000Z'),
          }),
          status: TransferStatus.COMPLETED,
        }),
      }),
    );

    // El dataset devuelto por el servicio contiene la legacy COMPLETED y excluye la CANCELLED
    expect(result.internalTransfers).toHaveLength(1);
    expect(result.internalTransfers[0].id).toBe('it-leg');
    expect(result.internalTransfers[0].status).toBe(TransferStatus.COMPLETED);
    expect((result.internalTransfers[0] as any).receiptSeries).toBeNull();
  });

  it('15. Conciliación por cuenta: closing = opening + ingresos - egresos + tIn - tOut', async () => {
    scenario();
    const wb = await excelService.generateExcel({ year: 2026, month: 10 });
    const ws = wb.getWorksheet('Resumen 2026-10')!;

    // Columna Nº Cuenta en conciliación
    const rCaja = findRow(ws, 'Caja')!;
    expect(rCaja.getCell(2).value).toBe('-');
    const rQR = findRow(ws, 'QR SOL')!;
    expect(rQR.getCell(2).value).toBe('123-456');

    // Caja: 1000 + 150 - 50 + 0 - 300 = 800 ; QR: 2000 + 230 - 25 + 300 - 0 = 2505
    const expected: Record<string, number> = { Caja: 800, 'QR SOL': 2505 };
    for (const [name, closing] of Object.entries(expected)) {
      const r = findRow(ws, name)!;
      const [opening, inc, exp, tin, tout, close] = [3, 4, 5, 6, 7, 8].map((c) => Number(r.getCell(c).value));
      expect(close).toBe(closing);
      expect(opening + inc + exp + tin + tout - close).toBeCloseTo(0, 2);
    }
    const tot = findRow(ws, 'TOTAL GENERAL')!;
    expect(Number(tot.getCell(6).value) + Number(tot.getCell(7).value)).toBe(0);
  });

  it('16. Resumen mensual de movimientos: Ingresos, Egresos, Transferencias y Conciliación Global', async () => {
    scenario();
    const wb = await excelService.generateExcel({ year: 2026, month: 10 });
    const ws1 = wb.getWorksheet('Resumen 2026-10')!;
    const ws2 = wb.getWorksheet('Egresos 2026-10')!;

    // 1 & 2. Summary Income = matrix Income, Summary Expense = matrix Expense
    const rSummaryTitle = findRow(ws1, 'RESUMEN MENSUAL DE MOVIMIENTOS');
    expect(rSummaryTitle).toBeDefined();

    const rSumInc = findRow(ws1, 'TOTAL INGRESOS EXTERNOS')!;
    const rSumExp = findRow(ws1, 'TOTAL EGRESOS EXTERNOS')!;
    const rMatrixInc = findRow(ws1, 'TOTAL MES')!;
    const rMatrixExp = findRow(ws2, 'TOTAL MES')!;

    const matrixIncVal = Number(rMatrixInc.getCell(rMatrixInc.cellCount).value);
    const matrixExpVal = Number(rMatrixExp.getCell(rMatrixExp.cellCount).value);

    expect(Number(rSumInc.getCell(4).value)).toBe(matrixIncVal);
    expect(Number(rSumExp.getCell(4).value)).toBe(matrixExpVal);

    // 3. Income grouping by category + FinancialAccount
    let basquetCaja: number | undefined;
    let basquetQR: number | undefined;
    let voleibolQR: number | undefined;
    let currentCat = '';
    let inIncomeSection = false;
    ws1.eachRow((r) => {
      const v1 = String(r.getCell(1).value || '');
      const v2 = String(r.getCell(2).value || '');
      if (v1 === '(1) INGRESOS EXTERNOS') { inIncomeSection = true; return; }
      if (v1 === 'TOTAL INGRESOS EXTERNOS') { inIncomeSection = false; return; }
      if (!inIncomeSection) return;
      if (v1.startsWith('Escuelas -')) currentCat = v1;
      if (currentCat.includes('Básquet') && v2 === 'Caja') basquetCaja = Number(r.getCell(4).value);
      if (currentCat.includes('Básquet') && v2 === 'QR SOL') basquetQR = Number(r.getCell(4).value);
      if (currentCat.includes('Voleibol') && v2 === 'QR SOL') voleibolQR = Number(r.getCell(4).value);
    });
    expect(basquetCaja).toBe(150);
    expect(basquetQR).toBe(30);
    expect(voleibolQR).toBe(200);

    // 4. Expense grouping by category + FinancialAccount
    let seguroCaja: number | undefined;
    let arbitrajeQR: number | undefined;
    currentCat = '';
    let inExpenseSection = false;
    ws1.eachRow((r) => {
      const v1 = String(r.getCell(1).value || '');
      const v2 = String(r.getCell(2).value || '');
      if (v1 === '(2) EGRESOS EXTERNOS') { inExpenseSection = true; return; }
      if (v1 === 'TOTAL EGRESOS EXTERNOS') { inExpenseSection = false; return; }
      if (!inExpenseSection) return;
      if (v1 === 'SEGURO' || v1 === 'ARBITRAJE') currentCat = v1;
      if (currentCat === 'SEGURO' && v2 === 'Caja') seguroCaja = Number(r.getCell(4).value);
      if (currentCat === 'ARBITRAJE' && v2 === 'QR SOL') arbitrajeQR = Number(r.getCell(4).value);
    });
    expect(seguroCaja).toBe(50);
    expect(arbitrajeQR).toBe(25);

    // 5 & 6. Account number displayed where available, NULL -> '-'
    let cajaAccNum: string | undefined;
    let qrAccNum: string | undefined;
    ws1.eachRow((r) => {
      const v2 = String(r.getCell(2).value || '');
      if (v2 === 'Caja') cajaAccNum = String(r.getCell(3).value);
      if (v2 === 'QR SOL') qrAccNum = String(r.getCell(3).value);
    });
    expect(cajaAccNum).toBe('-');
    expect(qrAccNum).toBe('123-456');

    // 7 & 8. Transfer incoming totals by dest, outgoing by source
    const rTrfIn = findRow(ws1, 'TOTAL ENTRADAS INTERNAS')!;
    const rTrfOut = findRow(ws1, 'TOTAL SALIDAS INTERNAS')!;
    expect(Number(rTrfIn.getCell(4).value)).toBe(300);
    expect(Number(rTrfOut.getCell(4).value)).toBe(300);

    // 9. Transfer net = 0
    const rTrfNet = findRow(ws1, 'NETO TRANSFERENCIAS (ENTRADAS - SALIDAS)')!;
    expect(Number(rTrfNet.getCell(4).value)).toBe(0);

    // 10. CANCELLED transfer absent (500 cancelled transfer not added)
    expect(Number(rTrfIn.getCell(4).value)).toBe(300);
    expect(Number(rTrfOut.getCell(4).value)).toBe(300);

    // 12. Result = income - expense
    const rPeriodResult = findRow(ws1, '(=) RESULTADO DEL PERÍODO')!;
    expect(Number(rPeriodResult.getCell(4).value)).toBe(380 - 75);

    // 13. Global closing equation reconciles
    let openingVal = 0;
    let closingVal = 0;
    ws1.eachRow((r) => {
      const v1 = String(r.getCell(1).value || '');
      if (v1.startsWith('SALDO INICIAL GLOBAL AL')) openingVal = Number(r.getCell(4).value);
      if (v1.startsWith('SALDO FINAL GLOBAL AL')) closingVal = Number(r.getCell(4).value);
    });
    expect(openingVal).toBe(3000);
    expect(closingVal).toBe(3305);
    expect(closingVal).toBe(openingVal + 380 - 75);

    // 14. APP_TIMEZONE preserved (30/09/2026 and 31/10/2026)
    let openDateStr = '';
    let closeDateStr = '';
    ws1.eachRow((r) => {
      const v1 = String(r.getCell(1).value || '');
      if (v1.startsWith('SALDO INICIAL GLOBAL AL')) openDateStr = v1;
      if (v1.startsWith('SALDO FINAL GLOBAL AL')) closeDateStr = v1;
    });
    expect(openDateStr).toContain('30/09/2026');
    expect(closeDateStr).toContain('31/10/2026');
  });
});

