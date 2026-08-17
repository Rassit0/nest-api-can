import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReportRegistry, ReportHandler } from '../../core/registry/report.registry';
import { PrinterService } from 'src/printer/printer.service';
import { PrismaService } from 'src/prisma.service';
import * as path from 'path';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { resolveEffectiveCategoryFromPayload, AccountCategoryWithParent } from 'src/payments/category-resolver.helper';
import { Transaction, PaymentMethod } from 'src/generated/prisma/client';

interface AggregatedGroup {
  categoryId: string;
  categoryName: string;
  isParent: boolean;
  receiptSeries: string;
  documentIds: Set<string>;
  minReceipt: number | null;
  maxReceipt: number | null;
  cash: number;
  qr: number;
  transfer: number;
  total: number;
  order: number;
  children: AggregatedGroup[];
}

@Injectable()
export class DetailedAccountingReport implements ReportHandler, OnModuleInit {
  constructor(
    private readonly registry: ReportRegistry,
    private readonly printer: PrinterService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.registry.register(
      {
        id: 'accounting.detailed',
        name: 'Informe de Ingresos Resumen (Detallado)',
        description: 'Reporte de ingresos detallado por grupos concepto, recibos y cuentas financieras.',
        formats: ['pdf'],
        filters: ['dateRange'],
        moduleName: 'Contabilidad',
      },
      this,
    );
  }

  private async getAccountingTransactions(start: Date, end: Date) {
    return this.prisma.transaction.findMany({
      where: {
        transactionDate: { gte: start, lte: end },
        isInternalTransfer: false,
        status: 'COMPLETED',
      },
      include: {
        payment: {
          include: {
            charge: {
              include: {
                accountCharge: {
                  include: { category: { include: { parent: true } } },
                },
                studentCharges: {
                  include: {
                    studentMembership: {
                      include: {
                        courseSeason: {
                          include: {
                            course: {
                              include: {
                                school: {
                                  include: { defaultAccountCategory: { include: { parent: true } } },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                membershipCharges: {
                  include: {
                    playerMembership: {
                      include: {
                        teamSeason: {
                          include: {
                            team: {
                              include: {
                                club: {
                                  include: { defaultAccountCategory: { include: { parent: true } } },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        transactionDate: 'asc'
      }
    });
  }

  private groupAccountingData(transactions: any[]) {
    // ParentCategory -> ChildCategory -> Series -> AggregatedGroup
    const parentMap = new Map<string, AggregatedGroup>();

    const getOrCreateGroup = (
      parentId: string, parentName: string, 
      childId: string, childName: string, 
      series: string
    ) => {
      let pGroup = parentMap.get(parentId);
      if (!pGroup) {
        pGroup = {
          categoryId: parentId,
          categoryName: parentName,
          isParent: true,
          receiptSeries: '',
          documentIds: new Set(),
          minReceipt: null,
          maxReceipt: null,
          cash: 0, qr: 0, transfer: 0, total: 0, order: 0,
          children: []
        };
        parentMap.set(parentId, pGroup);
      }

      const childKey = `${childId}_${series}`;
      let cGroup = pGroup.children.find(c => c.categoryId === childId && c.receiptSeries === series);
      if (!cGroup) {
        cGroup = {
          categoryId: childId,
          categoryName: childName,
          isParent: false,
          receiptSeries: series,
          documentIds: new Set(),
          minReceipt: null,
          maxReceipt: null,
          cash: 0, qr: 0, transfer: 0, total: 0, order: 0,
          children: []
        };
        pGroup.children.push(cGroup);
      }

      return { pGroup, cGroup };
    };

    for (const t of transactions) {
      let parentId = 'VIRTUAL_HISTORICAL';
      let parentName = 'OTROS / HISTÓRICO';
      let childId = 'VIRTUAL_HISTORICAL_CHILD';
      let childName = 'Sin Categorizar';
      
      let docId = t.id; // Fallback for expenses
      let series = t.receiptSeries || 'GEN';
      let number = t.receiptNumber || 0;

      if (t.payment) {
        docId = t.payment.id;
        series = t.payment.receiptSeries || 'GEN';
        number = t.payment.receiptNumber || 0;

        const cat = resolveEffectiveCategoryFromPayload(t.payment.charge);
        
        // 1. Determinar el grupo padre (ESCUELAS, EQUIPOS, PERSONALIZADOS, HISTÓRICO)
        if (series.startsWith('ESC')) {
          parentId = 'VIRTUAL_ESCUELAS';
          parentName = 'ESCUELAS';
          childId = series;
          childName = series;
        } else if (series.startsWith('EQP')) {
          parentId = 'VIRTUAL_EQUIPOS';
          parentName = 'EQUIPOS';
          childId = series;
          childName = series;
        } else if (cat && cat.code !== 'ESC' && cat.code !== 'EQP') {
          // Si es una categoría contable personalizada y está activa
          if (cat.isActive) {
            parentId = 'VIRTUAL_PERSONALIZADOS';
            parentName = 'PERSONALIZADOS';
            childId = cat.id;
            childName = cat.name;
          } else {
            // Histórico (categorías viejas como SYS-ESC, EQP-CAN que fueron desactivadas)
            parentId = 'VIRTUAL_HISTORICAL';
            parentName = 'OTROS / HISTÓRICO';
            childId = series;
            childName = `Histórico (${series})`;
          }
        } else {
          // Histórico genérico (EQ, CU, GEN, etc.)
          parentId = 'VIRTUAL_HISTORICAL';
          parentName = 'OTROS / HISTÓRICO';
          childId = series;
          childName = `Histórico (${series})`;
        }
      }

      const { pGroup, cGroup } = getOrCreateGroup(parentId, parentName, childId, childName, series);

      // Track document to avoid double accounting
      if (!cGroup.documentIds.has(docId)) {
        cGroup.documentIds.add(docId);
        pGroup.documentIds.add(docId);

        // Update min/max ONLY for the specific series group (child)
        if (cGroup.minReceipt === null || number < cGroup.minReceipt) cGroup.minReceipt = number;
        if (cGroup.maxReceipt === null || number > cGroup.maxReceipt) cGroup.maxReceipt = number;
      }

      // Financial amounts
      const amt = Number(t.amount || 0);
      let isPositive = t.type === 'INCOME' ? 1 : -1;
      const effectiveAmt = amt * isPositive;

      if (t.paymentMethod === 'CASH') {
        cGroup.cash += effectiveAmt;
        pGroup.cash += effectiveAmt;
      } else if (t.paymentMethod === 'QR') {
        cGroup.qr += effectiveAmt;
        pGroup.qr += effectiveAmt;
      } else if (t.paymentMethod === 'TRANSFER') {
        cGroup.transfer += effectiveAmt;
        pGroup.transfer += effectiveAmt;
      } else {
        // Fallback for any other method, we group it in CASH conceptually for now or just add to total.
        // We will add to CASH to avoid discarding, but log it.
        cGroup.cash += effectiveAmt;
        pGroup.cash += effectiveAmt;
      }

      cGroup.total += effectiveAmt;
      pGroup.total += effectiveAmt;
    }

    return Array.from(parentMap.values()).sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }

  async generate(params: any, format: string): Promise<any> {
    const today = new Date();
    const start = params.start ? new Date(params.start) : new Date(today.getFullYear(), today.getMonth(), 1);
    const end = params.end ? new Date(params.end) : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const transactions = await this.getAccountingTransactions(start, end);
    const groups = this.groupAccountingData(transactions);

    let grandTotal = 0;
    for (const g of groups) {
      grandTotal += g.total;
    }

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [30, 30, 30, 30],
      defaultStyle: {
        fontSize: 10,
      },
      content: [
        this.buildHeader(start, end, grandTotal),
        { text: '\n' },
        this.buildTable(groups, grandTotal),
      ],
      styles: {
        tableHeader: { bold: true, fontSize: 9, color: 'black', alignment: 'center', margin: [0, 4, 0, 4] },
        tableCell: { fontSize: 9, margin: [0, 4, 0, 4] },
        tableCellRight: { fontSize: 9, alignment: 'right', margin: [0, 4, 4, 4] },
        tableCellCenter: { fontSize: 9, alignment: 'center', margin: [0, 4, 0, 4] },
        boldRight: { bold: true, alignment: 'right', fontSize: 10, margin: [0, 4, 4, 4] },
      },
    };

    return this.printer.createPdf(docDefinition);
  }

  private buildHeader(start: Date, end: Date, grandTotal: number): Content {
    const logo = path.join(process.cwd(), 'dist', 'assets', 'logo-can.png');
    const totalFmt = grandTotal.toFixed(2);
    
    const dateFormatter = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
    const dateStr = `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`;
    
    return {
      columns: [
        {
          image: logo,
          width: 80,
          margin: [0, 0, 10, 0],
        },
        {
          stack: [
            { text: 'CLUB ATLETICO NACIONAL', bold: true, fontSize: 16, alignment: 'center' },
            { text: 'Fundado el 17 de Octubre de 1935', bold: true, fontSize: 10, alignment: 'center', margin: [0, 2, 0, 2] },
            { text: 'CAN Oruro - Telf. 2-52-33388', bold: true, fontSize: 9, alignment: 'center' },
            { text: 'Oruro - BOLIVIA', bold: true, fontSize: 9, alignment: 'center' },
            { 
              text: `INFORME de Ingresos Resumen (Total Bs ${totalFmt}) = Periodo ${dateStr}`, 
              bold: true, 
              fontSize: 10, 
              alignment: 'center',
              margin: [0, 10, 0, 0]
            }
          ],
          width: '*',
          margin: [0, 0, 40, 0]
        },
        {
          width: 80,
          text: '* Detalle Financiero Consolidado',
          fontSize: 7,
          alignment: 'right',
          italics: true,
        }
      ]
    };
  }

  private buildTable(groups: AggregatedGroup[], grandTotal: number): Content {
    const body: any[] = [
      [
        { text: 'N°', style: 'tableHeader' },
        { text: 'GRUPOS CONCEPTO', style: 'tableHeader' },
        { text: 'RECIBOS', style: 'tableHeader' },
        { text: 'NÚMEROS', style: 'tableHeader' },
        { text: 'CANTIDAD', style: 'tableHeader' },
        { text: 'QR', style: 'tableHeader' },
        { text: 'Banco/Trans', style: 'tableHeader' },
        { text: 'Efectivo', style: 'tableHeader' },
        { text: 'IMPORTE TOTAL', style: 'tableHeader' },
      ]
    ];

    let rowIndex = 1;

    for (const pGroup of groups) {
      body.push([
        { text: String(rowIndex++), style: 'tableCellCenter' },
        { text: pGroup.categoryName.toUpperCase(), style: 'tableCell', bold: true },
        { text: '', style: 'tableCellCenter' },
        { text: '', style: 'tableCellCenter' },
        { text: String(pGroup.documentIds.size), style: 'tableCellCenter', bold: true },
        { text: pGroup.qr.toFixed(2), style: 'tableCellRight', bold: true },
        { text: pGroup.transfer.toFixed(2), style: 'tableCellRight', bold: true },
        { text: pGroup.cash.toFixed(2), style: 'tableCellRight', bold: true },
        { text: pGroup.total.toFixed(2), style: 'tableCellRight', bold: true },
      ]);

      for (const cGroup of pGroup.children) {
        body.push([
          { text: String(rowIndex++), style: 'tableCellCenter' },
          { text: `* ${cGroup.categoryName.toUpperCase()}`, style: 'tableCell', margin: [10, 4, 0, 4] },
          { text: cGroup.receiptSeries, style: 'tableCellCenter' },
          { text: cGroup.minReceipt !== null && cGroup.maxReceipt !== null ? `${cGroup.minReceipt} - ${cGroup.maxReceipt}` : 'ninguno', style: 'tableCellCenter' },
          { text: String(cGroup.documentIds.size), style: 'tableCellCenter' },
          { text: cGroup.qr.toFixed(2), style: 'tableCellRight' },
          { text: cGroup.transfer.toFixed(2), style: 'tableCellRight' },
          { text: cGroup.cash.toFixed(2), style: 'tableCellRight' },
          { text: cGroup.total.toFixed(2), style: 'tableCellRight' },
        ]);
      }
    }

    body.push([
      { text: '', border: [false, false, false, false] },
      { text: '', border: [false, false, false, false] },
      { text: '', border: [false, false, false, false] },
      { text: '', border: [false, false, false, false] },
      { text: 'TOTAL:', style: 'boldRight', colSpan: 4, border: [false, false, false, false] },
      {},
      {},
      {},
      { text: `Bs ${grandTotal.toFixed(2)}`, style: 'boldRight', border: [true, true, true, true], fillColor: '#f2f2f2' },
    ]);

    return {
      table: {
        headerRows: 1,
        widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
        body
      }
    };
  }
}
