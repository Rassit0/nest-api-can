const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/reports/accounting/detailed/detailed-accounting.report.ts');
let content = fs.readFileSync(filePath, 'utf8');

const generateStart = content.indexOf('  async generate(params: any, format: string): Promise<any> {');
const buildTableStart = content.indexOf('  private buildTable(');

const newGenerate = `  async generate(params: any, format: string): Promise<any> {
    const today = new Date();
    let start = params.start
      ? new Date(params.start)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    let end = params.end
      ? new Date(params.end)
      : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const allAccounts = await this.prisma.financialAccount.findMany({ select: { id: true, name: true } });
    const accMap = new Map<string, string>();
    allAccounts.forEach(a => accMap.set(a.id, a.name));

    type AccountBalanceSummary = {
      accountId: string;
      accountName: string;
      openingBalance: number;
      periodIncome: number;
      periodExpense: number;
      transferIn: number;
      transferOut: number;
      transferNet: number;
      closingBalance: number;
    };
    
    const summaries = new Map<string, AccountBalanceSummary>();
    const getSummary = (id: string, fallbackName?: string): AccountBalanceSummary => {
      if (!summaries.has(id)) {
        summaries.set(id, {
          accountId: id,
          accountName: accMap.get(id) || fallbackName || 'Desconocida',
          openingBalance: 0,
          periodIncome: 0,
          periodExpense: 0,
          transferIn: 0,
          transferOut: 0,
          transferNet: 0,
          closingBalance: 0,
        });
      }
      return summaries.get(id)!;
    };

    // Calcular saldo histórico (Saldo Anterior) antes de \`start\`
    const historicalSums = await this.prisma.transaction.groupBy({
      by: ['type', 'financialAccountId'],
      _sum: { amount: true },
      where: {
        isInternalTransfer: false,
        OR: [
          { status: 'COMPLETED' },
          { status: 'CANCELLED', reversedBy: { isNot: null } },
        ],
        transactionDate: { lt: start },
      },
    });

    const historicalTransfers = await this.prisma.internalTransfer.findMany({
      where: {
        date: { lt: start },
        status: 'COMPLETED',
      },
      include: {
        sourceTransaction: { select: { financialAccountId: true } },
        destinationTransaction: { select: { financialAccountId: true } },
      }
    });
    
    let globalOpeningBalance = 0;
    
    historicalSums.forEach(sum => {
      const amount = Number(sum._sum.amount) || 0;
      const accId = sum.financialAccountId;
      const sumRef = getSummary(accId);

      if (sum.type === 'INCOME') {
        sumRef.openingBalance += amount;
        globalOpeningBalance += amount;
      }
      if (sum.type === 'EXPENSE') {
        sumRef.openingBalance -= amount;
        globalOpeningBalance -= amount;
      }
    });

    historicalTransfers.forEach(t => {
      const amount = Number(t.amount || 0);
      if (t.sourceTransaction) {
        getSummary(t.sourceTransaction.financialAccountId).openingBalance -= amount;
      }
      if (t.destinationTransaction) {
        getSummary(t.destinationTransaction.financialAccountId).openingBalance += amount;
      }
    });

    const incomeTxs = await this.getIncomeTransactions(start, end);
    const expenseTxs = await this.getExpenseTransactions(start, end);
    const transfers = await this.getAccountingTransfers(start, end);

    incomeTxs.forEach(t => {
      const amount = Number(t.amount || 0);
      const effectiveAmt = Math.abs(amount);
      const name = t.financialAccount?.name;
      getSummary(t.financialAccountId, name).periodIncome += effectiveAmt;
    });

    expenseTxs.forEach(t => {
      const amount = Number(t.amount || 0);
      const effectiveAmt = Math.abs(amount);
      const name = t.financialAccount?.name;
      getSummary(t.financialAccountId, name).periodExpense += effectiveAmt;
    });

    transfers.forEach(t => {
      const amount = Number(t.amount || 0);
      if (t.sourceTransaction) {
        const name = t.sourceTransaction.financialAccount?.name;
        getSummary(t.sourceTransaction.financialAccountId, name).transferOut += amount;
      }
      if (t.destinationTransaction) {
        const name = t.destinationTransaction.financialAccount?.name;
        getSummary(t.destinationTransaction.financialAccountId, name).transferIn += amount;
      }
    });

    const activeSummaries: AccountBalanceSummary[] = [];
    let sumAccountOpening = 0;
    let sumAccountClosing = 0;

    for (const summary of summaries.values()) {
      summary.transferNet = summary.transferIn - summary.transferOut;
      summary.closingBalance = summary.openingBalance + summary.periodIncome - summary.periodExpense + summary.transferNet;

      if (Math.abs(summary.openingBalance) > 0.001 || 
          Math.abs(summary.periodIncome) > 0.001 || 
          Math.abs(summary.periodExpense) > 0.001 || 
          Math.abs(summary.transferIn) > 0.001 || 
          Math.abs(summary.transferOut) > 0.001 || 
          Math.abs(summary.closingBalance) > 0.001) {
        activeSummaries.push(summary);
      }

      sumAccountOpening += summary.openingBalance;
      sumAccountClosing += summary.closingBalance;
    }
    
    activeSummaries.sort((a, b) => a.accountName.localeCompare(b.accountName));

    const categories = await this.prisma.accountCategory.findMany();
    const categoryNameBySeries = new Map<string, string>();
    for (const c of categories) {
      if (c.receiptSeries) categoryNameBySeries.set(c.receiptSeries, c.name);
      if (c.code) categoryNameBySeries.set(c.code, c.name);
    }

    const incomeData = this.groupAccountingData(incomeTxs, categoryNameBySeries);
    const expenseData = this.groupAccountingData(expenseTxs, categoryNameBySeries);

    let grandTotalIncome = 0;
    for (const g of incomeData.groups) {
      grandTotalIncome += g.total;
    }

    let grandTotalExpense = 0;
    for (const g of expenseData.groups) {
      grandTotalExpense += g.total;
    }

    const periodBalance = grandTotalIncome - grandTotalExpense;
    const globalClosingBalance = globalOpeningBalance + periodBalance;

    // INVARIANTE VALIDATION
    if (Math.abs(sumAccountOpening - globalOpeningBalance) > 0.01) {
      console.error(\`INVARIANT FAILED: sumAccountOpening (\${sumAccountOpening}) != globalOpeningBalance (\${globalOpeningBalance})\`);
    }
    if (Math.abs(sumAccountClosing - globalClosingBalance) > 0.01) {
      console.error(\`INVARIANT FAILED: sumAccountClosing (\${sumAccountClosing}) != globalClosingBalance (\${globalClosingBalance})\`);
    }

    const content: Content[] = [
      this.buildHeader(start, end),
    ];

    // RESUMEN GENERAL COMPACTO
    content.push({
      table: {
        widths: ['*', '*', '*', '*', '*'],
        body: [
          [
            { text: 'ANTERIOR', style: 'tableHeader', alignment: 'center' },
            { text: 'INGRESOS', style: 'tableHeader', alignment: 'center' },
            { text: 'EGRESOS', style: 'tableHeader', alignment: 'center' },
            { text: 'NETO PERÍODO', style: 'tableHeader', alignment: 'center' },
            { text: 'NUEVO SALDO', style: 'tableHeader', alignment: 'center' },
          ],
          [
            { text: \`Bs \${globalOpeningBalance.toFixed(2)}\`, style: 'tableCellCenter', bold: true, margin: [0, 4, 0, 4] },
            { text: \`Bs \${grandTotalIncome.toFixed(2)}\`, style: 'tableCellCenter', bold: true, color: '#27AE60', margin: [0, 4, 0, 4] },
            { text: \`Bs \${grandTotalExpense.toFixed(2)}\`, style: 'tableCellCenter', bold: true, color: '#C0392B', margin: [0, 4, 0, 4] },
            { text: \`Bs \${periodBalance.toFixed(2)}\`, style: 'tableCellCenter', bold: true, color: periodBalance >= 0 ? '#1F4E79' : '#C0392B', margin: [0, 4, 0, 4] },
            { text: \`Bs \${globalClosingBalance.toFixed(2)}\`, style: 'tableCellCenter', bold: true, color: '#1F4E79', fontSize: 9, margin: [0, 4, 0, 4] },
          ]
        ]
      },
      layout: {
        fillColor: function (rowIndex) {
          return (rowIndex === 0) ? '#E8ECF1' : '#F5F8FA';
        },
        hLineWidth: function (i, node) { return (i === 0 || i === 1 || i === node.table.body.length) ? 1.5 : 0.5; },
        vLineWidth: function () { return 0; },
        hLineColor: function (i, node) { return (i === 0 || i === node.table.body.length) ? '#1F4E79' : '#E0E0E0'; }
      },
      margin: [0, 0, 0, 10],
    });

    // RESUMEN POR CUENTA COMPACTO
    if (activeSummaries.length > 0) {
      const accBody: any[] = [
        [
          { text: 'CUENTA', style: 'tableHeader', alignment: 'left' },
          { text: 'ANTERIOR', style: 'tableHeader', alignment: 'right' },
          { text: 'INGRESOS', style: 'tableHeader', alignment: 'right' },
          { text: 'EGRESOS', style: 'tableHeader', alignment: 'right' },
          { text: 'TRANSF. NETA', style: 'tableHeader', alignment: 'right' },
          { text: 'FINAL', style: 'tableHeader', alignment: 'right' },
        ]
      ];

      for (const sum of activeSummaries) {
        accBody.push([
          { text: sum.accountName, style: 'tableCell', bold: true },
          { text: sum.openingBalance.toFixed(2), style: 'tableCellRight' },
          { text: sum.periodIncome.toFixed(2), style: 'tableCellRight', color: sum.periodIncome > 0 ? '#27AE60' : undefined },
          { text: sum.periodExpense.toFixed(2), style: 'tableCellRight', color: sum.periodExpense > 0 ? '#C0392B' : undefined },
          { text: sum.transferNet.toFixed(2), style: 'tableCellRight', color: sum.transferNet !== 0 ? '#F39C12' : undefined },
          { text: sum.closingBalance.toFixed(2), style: 'tableCellRight', bold: true, color: '#1F4E79' },
        ]);
      }

      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: accBody,
        },
        layout: {
          hLineWidth: function (i, node) { return (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5; },
          vLineWidth: function () { return 0; },
          hLineColor: function (i, node) { return (i === 0 || i === 1 || i === node.table.body.length) ? '#1F4E79' : '#E0E0E0'; },
          fillColor: function (rowIndex) { return (rowIndex === 0) ? '#E8ECF1' : (rowIndex % 2 === 0 ? '#FAFAFA' : null); },
          paddingTop: function() { return 2; },
          paddingBottom: function() { return 2; }
        },
        margin: [0, 0, 0, 15],
      });
    }

    if (incomeData.groups.length > 0) {
      content.push({
        text: 'INGRESOS',
        style: 'sectionTitle',
        margin: [0, 0, 0, 3],
      });
      content.push(
        this.buildTable(
          incomeData.groups,
          incomeData.activeAccounts,
          grandTotalIncome,
        ),
      );
    }

    if (expenseData.groups.length > 0) {
      content.push({
        text: 'EGRESOS',
        style: 'sectionTitle',
        margin: [0, 5, 0, 3],
      });
      content.push(
        this.buildTable(
          expenseData.groups,
          expenseData.activeAccounts,
          grandTotalExpense,
          true
        ),
      );
    }

    if (transfers.length > 0) {
      content.push({
        text: 'MOVIMIENTOS INTERNOS Y RECLASIFICACIONES',
        style: 'sectionTitle',
        margin: [0, 5, 0, 3],
      });
      content.push(this.buildTransfersTable(transfers));
    }

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [20, 20, 20, 30],
      footer: function (currentPage: number, pageCount: number) {
        return {
          text: \`Página \${currentPage} de \${pageCount}\`,
          alignment: 'center',
          fontSize: 8,
          color: '#555555',
          margin: [0, 10, 0, 0],
        };
      },
      defaultStyle: {
        fontSize: 8,
        lineHeight: 1.1,
      },
      content,
      styles: {
        sectionTitle: {
          bold: true,
          fontSize: 9, // Reduced
          color: '#1F4E79',
          margin: [0, 4, 0, 2], // Reduced margin
        },
        tableHeader: {
          bold: true,
          fontSize: 7,
          color: '#1F4E79',
          fillColor: '#E8ECF1',
          alignment: 'center',
          margin: [0, 2, 0, 2],
        },
        tableCell: {
          fontSize: 7,
          margin: [0, 2, 0, 2],
        },
        tableCellRight: {
          fontSize: 7,
          alignment: 'right',
          margin: [0, 2, 4, 2],
        },
        tableCellCenter: {
          fontSize: 7,
          alignment: 'center',
          margin: [0, 2, 0, 2],
        },
        boldRight: {
          bold: true,
          alignment: 'right',
          fontSize: 8,
          margin: [0, 2, 4, 2],
        },
        groupCell: {
          fontSize: 7,
          bold: true,
          margin: [0, 2, 0, 2],
        },
      },
    };

    return this.printer.createPdf(docDefinition);
  }

  private buildHeader(
    start: Date,
    end: Date,
  ): Content {
    const logo = path.join(process.cwd(), 'dist', 'assets', 'logo-can.png');

    const dateFormatter = new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/La_Paz',
    });
    const dateStr = \`\${dateFormatter.format(start)} — \${dateFormatter.format(end)}\`;

    return {
      table: {
        widths: ['auto', '*', 'auto'],
        body: [
          [
            {
              image: logo,
              width: 35, // Reduced width
              margin: [0, 0, 6, 0], // Reduced margin
              border: [false, false, false, false],
            },
            {
              stack: [
                {
                  text: 'CLUB ATLÉTICO NACIONAL',
                  bold: true,
                  fontSize: 10, // Reduced
                  color: '#1F4E79',
                },
                {
                  text: 'CAN Oruro · Telf. 2-52-33388 · Oruro - BOLIVIA',
                  fontSize: 7, // Reduced
                  color: '#555555',
                  margin: [0, 1, 0, 0], // Reduced
                },
              ],
              margin: [0, 0, 0, 0], // Reduced
              border: [false, false, false, false],
            },
            {
              stack: [
                {
                  text: 'INFORME DETALLADO CONTABLE',
                  bold: true,
                  fontSize: 9,
                  color: '#1F4E79',
                  alignment: 'right',
                  margin: [0, 0, 0, 1], // Reduced
                },
                {
                  text: dateStr,
                  fontSize: 8,
                  color: '#555555',
                  alignment: 'right',
                }
              ],
              margin: [0, 0, 0, 0],
              border: [false, false, false, false],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: function (i, node) {
          return (i === node.table.body.length) ? 1 : 0; // Only bottom border
        },
        vLineWidth: function (i, node) {
          return 0;
        },
        hLineColor: function (i, node) {
          return '#1F4E79';
        },
        paddingTop: function() { return 2; }, // Reduced
        paddingBottom: function() { return 2; } // Reduced
      },
      margin: [0, 0, 0, 8], // Reduced bottom margin to 8
    };
  }
`;

content = content.slice(0, generateStart) + newGenerate + '\n\n' + content.slice(buildTableStart);
fs.writeFileSync(filePath, content, 'utf8');
