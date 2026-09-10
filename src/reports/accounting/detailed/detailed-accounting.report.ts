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
  accounts: Record<string, number>;
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

  private async getIncomeTransactions(start: Date, end: Date) {
    const paymentInclude = {
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
                              include: { defaultAccountCategory: { include: { parent: true } }, discipline: true },
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
                              include: { defaultAccountCategory: { include: { parent: true } }, discipline: true },
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
    };

    return this.prisma.transaction.findMany({
      where: {
        transactionDate: { gte: start, lte: end },
        isInternalTransfer: false,
        type: 'INCOME',
        OR: [
          { status: 'COMPLETED' },
          { status: 'CANCELLED', reversedBy: { isNot: null } },
        ],
      },
      include: {
        financialAccount: { select: { name: true } },
        payment: paymentInclude,
        reverses: {
          include: { payment: paymentInclude },
        },
      },
      orderBy: {
        transactionDate: 'asc'
      }
    });
  }

  private async getExpenseTransactions(start: Date, end: Date) {
    return this.prisma.transaction.findMany({
      where: {
        transactionDate: { gte: start, lte: end },
        isInternalTransfer: false,
        type: 'EXPENSE',
        OR: [
          { status: 'COMPLETED' },
          { status: 'CANCELLED', reversedBy: { isNot: null } },
        ],
      },
      include: {
        financialAccount: { select: { name: true } },
        thirdParty: { select: { name: true } },
        payment: {
          include: {
            charge: {
              include: {
                accountCharge: {
                  include: {
                    person: { select: { name: true, lastName: true } },
                  }
                }
              }
            }
          }
        },
        reverses: {
          include: {
            payment: {
              include: {
                charge: {
                  include: {
                    accountCharge: {
                      include: {
                        person: { select: { name: true, lastName: true } },
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        transactionDate: 'asc'
      }
    });
  }

  private async getAccountingTransfers(start: Date, end: Date) {
    return this.prisma.internalTransfer.findMany({
      where: {
        date: { gte: start, lte: end },
        status: 'COMPLETED',
      },
      include: {
        sourceTransaction: { include: { financialAccount: true } },
        destinationTransaction: { include: { financialAccount: true } },
      },
      orderBy: { date: 'asc' },
    });
  }

  private groupAccountingData(transactions: any[]) {
    // ParentCategory -> ChildCategory -> Series -> AggregatedGroup
    const parentMap = new Map<string, AggregatedGroup>();
    const activeAccountNames = new Set<string>();

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
          accounts: {}, total: 0, order: 0,
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
          accounts: {}, total: 0, order: 0,
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

      let payment = t.payment;
      if (t.reversesId && t.reverses?.payment) {
        payment = t.reverses.payment;
      }

      if (payment) {
        docId = t.reversesId ? t.id : payment.id;
        series = payment.receiptSeries || 'GEN';
        number = payment.receiptNumber || 0;

        const cat = resolveEffectiveCategoryFromPayload(payment.charge);
          
        let entityName: string | undefined;
        let entityId: string | undefined;
        let disciplineName: string | undefined;

        if (payment.charge?.studentCharges?.[0]?.studentMembership?.courseSeason?.course?.school) {
          const school = payment.charge.studentCharges[0].studentMembership.courseSeason.course.school;
          entityName = school.name;
          entityId = school.id;
          disciplineName = school.discipline?.name;
        } else if (payment.charge?.membershipCharges?.[0]?.playerMembership?.teamSeason?.team?.club) {
          const club = payment.charge.membershipCharges[0].playerMembership.teamSeason.team.club;
          entityName = club.name;
          entityId = club.id;
          disciplineName = club.discipline?.name;
        }

        const getChildName = (entName: string | undefined, catName: string | undefined, ser: string, defaultName: string, discName?: string) => {
          const baseName = entName || catName;
          if (!baseName) return defaultName;
          let suffix = '';
          if (discName) {
            suffix = ` (${discName.toUpperCase()})`;
          }
          let prefix = '';
          if (ser.includes('MAT')) prefix = 'Matrícula de ';
          else if (ser.includes('REC')) prefix = 'Recargo de ';
          return `${prefix}${baseName}${suffix}`;
        };
        
        // 1. Determinar el grupo padre (ESCUELAS, EQUIPOS, PERSONALIZADOS, HISTÓRICO)
        if (series.startsWith('ESC')) {
          parentId = 'VIRTUAL_ESCUELAS';
          parentName = 'ESCUELAS';
          const resolvedId = entityId || (cat ? cat.id : series);
          childId = `${resolvedId}_${series}`;
          childName = getChildName(entityName, cat?.name, series, series, disciplineName);
        } else if (series.startsWith('EQP')) {
          parentId = 'VIRTUAL_EQUIPOS';
          parentName = 'EQUIPOS';
          const resolvedId = entityId || (cat ? cat.id : series);
          childId = `${resolvedId}_${series}`;
          childName = getChildName(entityName, cat?.name, series, series, disciplineName);
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
            childName = `Histórico`;
          }
        } else {
          // Histórico genérico (EQ, CU, GEN, etc.)
          parentId = 'VIRTUAL_HISTORICAL';
          parentName = 'OTROS / HISTÓRICO';
          childId = series;
          childName = `Histórico`;
        }
      }

      const { pGroup, cGroup } = getOrCreateGroup(parentId, parentName, childId, childName, series);

      // Track document to avoid double accounting
      if (!cGroup.documentIds.has(docId)) {
        pGroup.documentIds.add(docId);
        cGroup.documentIds.add(docId);
        
        // Actualizar rango de recibos para el PADRE y CHILD
        if (number > 0) {
          if (pGroup.minReceipt === null || number < pGroup.minReceipt) pGroup.minReceipt = number;
          if (pGroup.maxReceipt === null || number > pGroup.maxReceipt) pGroup.maxReceipt = number;

          if (cGroup.minReceipt === null || number < cGroup.minReceipt) cGroup.minReceipt = number;
          if (cGroup.maxReceipt === null || number > cGroup.maxReceipt) cGroup.maxReceipt = number;
        }
      }

      // Financial amounts
      const amt = Number(t.amount || 0);
      let isPositive = t.type === 'INCOME' ? 1 : -1;
      const effectiveAmt = amt * isPositive;

      const accName = t.financialAccount?.name || 'Desconocida';
      activeAccountNames.add(accName);

      cGroup.accounts[accName] = (cGroup.accounts[accName] || 0) + effectiveAmt;
      pGroup.accounts[accName] = (pGroup.accounts[accName] || 0) + effectiveAmt;

      cGroup.total += effectiveAmt;
      pGroup.total += effectiveAmt;
    }

    const groups = Array.from(parentMap.values()).sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    
    // Sort children inside each parent by their visible name (categoryName)
    for (const group of groups) {
      group.children.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    }

    return {
      groups,
      activeAccounts: Array.from(activeAccountNames).sort()
    };
  }

  async generate(params: any, format: string): Promise<any> {
    const today = new Date();
    let start = params.start ? new Date(params.start) : new Date(today.getFullYear(), today.getMonth(), 1);
    let end = params.end ? new Date(params.end) : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    if (params.end && typeof params.end === 'string' && !params.end.includes('T')) {
      end.setUTCHours(23, 59, 59, 999);
    }

    const incomeTxs = await this.getIncomeTransactions(start, end);
    const expenseTxs = await this.getExpenseTransactions(start, end);
    const transfers = await this.getAccountingTransfers(start, end);

    const incomeData = this.groupAccountingData(incomeTxs);

    let grandTotalIncome = 0;
    for (const g of incomeData.groups) {
      grandTotalIncome += g.total;
    }

    let grandTotalExpense = 0;
    for (const t of expenseTxs) {
      grandTotalExpense += Number(t.amount || 0);
    }

    const content: Content[] = [
      this.buildHeader(start, end, grandTotalIncome, grandTotalExpense),
      { text: '\n' },
    ];

    if (incomeData.groups.length > 0) {
      content.push({ text: 'INGRESOS', style: 'sectionTitle', margin: [0, 0, 0, 5] });
      content.push(this.buildTable(incomeData.groups, incomeData.activeAccounts, grandTotalIncome));
    }

    if (expenseTxs.length > 0) {
      content.push({ text: '\nEGRESOS', style: 'sectionTitle', margin: [0, 10, 0, 5] });
      content.push(this.buildExpenseTable(expenseTxs, grandTotalExpense));
    }

    if (transfers.length > 0) {
      content.push({ text: '\nMOVIMIENTOS INTERNOS Y RECLASIFICACIONES', style: 'sectionTitle', margin: [0, 10, 0, 5] });
      content.push(this.buildTransfersTable(transfers));
    }

    const balance = grandTotalIncome - grandTotalExpense;
    content.push({ text: '\nRESUMEN DEL PERIODO', style: 'sectionTitle', margin: [0, 15, 0, 5] });
    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [{ text: 'TOTAL INGRESOS', bold: true, border: [false, false, false, false] }, { text: `Bs ${grandTotalIncome.toFixed(2)}`, alignment: 'right', border: [false, false, false, false] }],
          [{ text: 'TOTAL EGRESOS', bold: true, border: [false, false, false, true] }, { text: `Bs ${grandTotalExpense.toFixed(2)}`, alignment: 'right', border: [false, false, false, true] }],
          [{ text: 'SALDO NETO DEL PERIODO', bold: true, border: [false, false, false, false] }, { text: `Bs ${balance.toFixed(2)}`, alignment: 'right', bold: true, fillColor: '#f2f2f2', border: [true, true, true, true] }]
        ]
      }
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [20, 20, 20, 30],
      footer: function(currentPage: number, pageCount: number) {
        return {
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          margin: [0, 10, 0, 0]
        };
      },
      defaultStyle: {
        fontSize: 10,
      },
      content,
      styles: {
        sectionTitle: { bold: true, fontSize: 12, color: 'black' },
        tableHeader: { bold: true, fontSize: 8, color: 'black', alignment: 'center', margin: [0, 2, 0, 2] },
        tableCell: { fontSize: 8, margin: [0, 2, 0, 2] },
        tableCellRight: { fontSize: 8, alignment: 'right', margin: [0, 2, 4, 2] },
        tableCellCenter: { fontSize: 8, alignment: 'center', margin: [0, 2, 0, 2] },
        boldRight: { bold: true, alignment: 'right', fontSize: 9, margin: [0, 2, 4, 2] },
      },
    };

    return this.printer.createPdf(docDefinition);
  }

  private buildHeader(start: Date, end: Date, grandTotalIncome: number, grandTotalExpense: number): Content {
    const logo = path.join(process.cwd(), 'dist', 'assets', 'logo-can.png');
    const incomeFmt = grandTotalIncome.toFixed(2);
    const expenseFmt = grandTotalExpense.toFixed(2);
    const balanceFmt = (grandTotalIncome - grandTotalExpense).toFixed(2);
    
    const dateFormatter = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/La_Paz' });
    const dateStr = `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`;
    
    return {
      columns: [
        {
          image: logo,
          width: 50,
          margin: [0, 0, 10, 0],
        },
        {
          stack: [
            { text: 'CLUB ATLETICO NACIONAL', bold: true, fontSize: 12, alignment: 'center' },
            { text: 'Fundado el 17 de Octubre de 1935 | CAN Oruro - Telf. 2-52-33388 | Oruro - BOLIVIA', fontSize: 8, alignment: 'center', margin: [0, 2, 0, 2] },
            { 
              text: `INFORME DETALLADO (Ingresos Bs ${incomeFmt} | Egresos Bs ${expenseFmt} | Saldo Bs ${balanceFmt}) = Periodo ${dateStr}`, 
              bold: true, 
              fontSize: 9, 
              alignment: 'center',
              margin: [0, 5, 0, 0]
            }
          ],
          width: '*',
          margin: [0, 0, 10, 0]
        },
        {
          width: 50,
          text: '* Detalle Financiero',
          fontSize: 7,
          alignment: 'right',
          italics: true,
        }
      ]
    };
  }

  private buildTable(groups: AggregatedGroup[], activeAccounts: string[], grandTotal: number): Content {
    const headerRow: any[] = [
      { text: 'N°', style: 'tableHeader' },
      { text: 'GRUPOS CONCEPTO', style: 'tableHeader' },
      { text: 'RECIBOS', style: 'tableHeader' },
      { text: 'NÚMEROS', style: 'tableHeader' },
      { text: 'CANTIDAD', style: 'tableHeader' },
    ];

    activeAccounts.forEach(acc => {
      headerRow.push({ text: acc, style: 'tableHeader' });
    });

    headerRow.push({ text: 'IMPORTE TOTAL', style: 'tableHeader' });

    const body: any[] = [headerRow];

    let rowIndex = 1;

    for (const pGroup of groups) {
      const pRow: any[] = [
        { text: String(rowIndex++), style: 'tableCellCenter' },
        { text: pGroup.categoryName.toUpperCase(), style: 'tableCell', bold: true },
        { text: '', style: 'tableCellCenter' },
        { text: pGroup.minReceipt !== null && pGroup.maxReceipt !== null ? `${pGroup.minReceipt} - ${pGroup.maxReceipt}` : '', style: 'tableCellCenter', bold: true },
        { text: String(pGroup.documentIds.size), style: 'tableCellCenter', bold: true },
      ];

      activeAccounts.forEach(acc => {
        const val = pGroup.accounts[acc] || 0;
        pRow.push({ text: val.toFixed(2), style: 'tableCellRight', bold: true });
      });

      pRow.push({ text: pGroup.total.toFixed(2), style: 'tableCellRight', bold: true });
      body.push(pRow);

      for (const cGroup of pGroup.children) {
        const cRow: any[] = [
          { text: String(rowIndex++), style: 'tableCellCenter' },
          { text: `* ${cGroup.categoryName.toUpperCase()}`, style: 'tableCell', margin: [10, 2, 0, 2] },
          { text: cGroup.receiptSeries, style: 'tableCellCenter' },
          { text: cGroup.minReceipt !== null && cGroup.maxReceipt !== null ? `${cGroup.minReceipt} - ${cGroup.maxReceipt}` : 'ninguno', style: 'tableCellCenter' },
          { text: String(cGroup.documentIds.size), style: 'tableCellCenter' },
        ];

        activeAccounts.forEach(acc => {
          const val = cGroup.accounts[acc] || 0;
          cRow.push({ text: val.toFixed(2), style: 'tableCellRight' });
        });

        cRow.push({ text: cGroup.total.toFixed(2), style: 'tableCellRight' });
        body.push(cRow);
      }
    }

    const totalRow: any[] = [
      { text: '', border: [false, false, false, false] },
      { text: '', border: [false, false, false, false] },
      { text: '', border: [false, false, false, false] },
      { text: '', border: [false, false, false, false] },
      { text: 'TOTAL:', style: 'boldRight', border: [false, false, false, false] },
    ];
    
    const totalsByAcc: Record<string, number> = {};
    for (const pGroup of groups) {
      activeAccounts.forEach(acc => {
        totalsByAcc[acc] = (totalsByAcc[acc] || 0) + (pGroup.accounts[acc] || 0);
      });
    }

    activeAccounts.forEach(acc => {
      totalRow.push({ text: totalsByAcc[acc].toFixed(2), style: 'boldRight', border: [true, true, true, true] });
    });

    totalRow.push({ text: `Bs ${grandTotal.toFixed(2)}`, style: 'boldRight', border: [true, true, true, true], fillColor: '#f2f2f2' });

    body.push(totalRow);

    const widths: any[] = ['auto', '*', 'auto', 'auto', 'auto'];
    activeAccounts.forEach(() => widths.push('auto'));
    widths.push('auto');

    return {
      table: {
        headerRows: 1,
        widths,
        body
      }
    };
  }

  private buildExpenseTable(expenses: any[], grandTotal: number): Content {
    const headerRow: any[] = [
      { text: 'N°', style: 'tableHeader' },
      { text: 'FECHA', style: 'tableHeader' },
      { text: 'DOCUMENTO', style: 'tableHeader' },
      { text: 'PROVEEDOR / CONCEPTO', style: 'tableHeader' },
      { text: 'DESCRIPCIÓN', style: 'tableHeader' },
      { text: 'CUENTA', style: 'tableHeader' },
      { text: 'IMPORTE', style: 'tableHeader' },
    ];

    const body: any[] = [headerRow];
    let rowIndex = 1;

    for (const tx of expenses) {
      const dateStr = new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(tx.transactionDate));
      
      let docSeries = tx.receiptSeries;
      let docNumber = tx.receiptNumber;
      let thirdPartyName = tx.thirdParty?.name;

      let payment = tx.payment;
      if (tx.reversesId && tx.reverses?.payment) {
        payment = tx.reverses.payment;
      }

      if (payment) {
        docSeries = payment.receiptSeries || docSeries;
        docNumber = payment.receiptNumber || docNumber;

        const accCharge = payment.charge?.accountCharge;
        if (accCharge) {
          if (accCharge.person) {
            thirdPartyName = `${accCharge.person.name} ${accCharge.person.lastName}`;
          } else if (accCharge.externalEntity) {
            thirdPartyName = accCharge.externalEntity;
          }
        }
      }

      const documentStr = docSeries && docNumber ? `${docSeries}-${docNumber}` : 'S/D';
      const conceptStr = thirdPartyName || tx.description || 'Sin concepto';
      const descStr = tx.description || '';
      const accStr = tx.financialAccount?.name || 'Desconocida';
      const amt = Number(tx.amount || 0);

      body.push([
        { text: String(rowIndex++), style: 'tableCellCenter' },
        { text: dateStr, style: 'tableCellCenter' },
        { text: documentStr, style: 'tableCellCenter' },
        { text: conceptStr.toUpperCase(), style: 'tableCell' },
        { text: descStr, style: 'tableCell' },
        { text: accStr, style: 'tableCellCenter' },
        { text: `- ${amt.toFixed(2)}`, style: 'tableCellRight' },
      ]);
    }

    const totalRow: any[] = [
      { text: '', border: [false, false, false, false] },
      { text: '', border: [false, false, false, false] },
      { text: '', border: [false, false, false, false] },
      { text: '', border: [false, false, false, false] },
      { text: '', border: [false, false, false, false] },
      { text: 'TOTAL:', style: 'boldRight', border: [false, false, false, false] },
      { text: `- Bs ${grandTotal.toFixed(2)}`, style: 'boldRight', border: [true, true, true, true], fillColor: '#f2f2f2' },
    ];

    body.push(totalRow);

    return {
      table: {
        headerRows: 1,
        widths: ['auto', 'auto', 'auto', '*', '*', 'auto', 'auto'],
        body
      }
    };
  }

  private buildTransfersTable(transfers: any[]): Content {
    const body: any[] = [
      [
        { text: 'Fecha', style: 'tableHeader' },
        { text: 'Origen', style: 'tableHeader' },
        { text: 'Destino', style: 'tableHeader' },
        { text: 'Importe', style: 'tableHeader' },
      ]
    ];

    let total = 0;
    for (const t of transfers) {
      const amt = Number(t.amount || 0);
      total += amt;
      const src = t.sourceTransaction?.financialAccount?.name || 'Desconocida';
      const dst = t.destinationTransaction?.financialAccount?.name || 'Desconocida';
      const dateStr = new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(t.date));

      body.push([
        { text: dateStr, style: 'tableCellCenter' },
        { text: src, style: 'tableCell' },
        { text: dst, style: 'tableCell' },
        { text: amt.toFixed(2), style: 'tableCellRight' },
      ]);
    }

    body.push([
      { text: 'TOTAL MOVIMIENTOS INTERNOS:', style: 'boldRight', colSpan: 3, border: [false, false, false, false] },
      {},
      {},
      { text: `Bs ${total.toFixed(2)}`, style: 'boldRight', border: [true, true, true, true], fillColor: '#f2f2f2' },
    ]);

    return {
      table: {
        headerRows: 1,
        widths: ['auto', '*', '*', 'auto'],
        body
      }
    };
  }
}
