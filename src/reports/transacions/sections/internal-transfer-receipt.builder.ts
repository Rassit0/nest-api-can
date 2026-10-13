import type { Content } from 'pdfmake/interfaces';
import * as path from 'path';
import { TransactionReceiptData } from '../interfaces/transaction-receipt-data.interface';
import { footerSection } from './footer.section';

export const buildInternalTransferReceiptContent = (
  startY: number,
  data: TransactionReceiptData,
): Content[] => {
  const isCancelled = data.concept.startsWith('[ANULADA]');

  return [
    // WATERMARK
    {
      image: path.join(process.cwd(), 'dist', 'assets', 'logo-can-negro.png'),
      width: 120, // Smaller
      opacity: 0.05, // More subtle
      absolutePosition: { x: 200, y: startY + 50 },
    },
    
    // MAIN CONTENT CONTAINER
    {
      absolutePosition: { x: 20, y: startY - 5 },
      columns: [
        {
          width: 356,
          stack: [
            // HEADER
            {
              columns: [
                {
                  width: 45,
                  image: path.join(process.cwd(), 'dist', 'assets', 'logo-can.png'),
                  margin: [0, 0, 10, 0],
                },
                {
                  width: 140,
                  stack: [
                    { text: 'CLUB ATLÉTICO NACIONAL', bold: true, fontSize: 8 },
                    { text: 'FUNDADO EL 17 DE OCTUBRE DE 1935', fontSize: 5, margin: [0, 2, 0, 1] },
                    { text: 'DIR: 6 de octubre y Rodriguez\n(Parque de la Unión Nacional)\nORURO - BOLIVIA', fontSize: 5, lineHeight: 1.1 },
                  ],
                  margin: [10, 5, 0, 0],
                },
                {
                  width: '*',
                  stack: [
                    { text: 'COMPROBANTE DE', bold: true, fontSize: 10, alignment: 'right' },
                    { text: 'TRANSFERENCIA INTERNA', bold: true, fontSize: 10, alignment: 'right', margin: [0, 0, 0, 4] },
                    { text: `N° ${data.receiptSeries}-${data.receiptNumber}`, fontSize: 9, bold: true, alignment: 'right', margin: [0, 0, 0, 2] },
                    { text: data.date.toLocaleDateString('es-BO'), fontSize: 8, alignment: 'right' },
                    isCancelled ? { text: 'TRANSFERENCIA CANCELADA', bold: true, color: '#B91C1C', fontSize: 10, alignment: 'right', margin: [0, 4, 0, 0] } : { text: '' }
                  ],
                }
              ],
              margin: [20, 5, 25, 2],
            },
            
            // SEPARATOR
            {
              canvas: [{ type: 'line', x1: 0, y1: 0, x2: 356, y2: 0, lineWidth: 0.5, lineColor: '#CCCCCC' }],
              margin: [0, 1, 0, 1],
            },

            // ORIGIN & DESTINATION
            {
              margin: [20, 1, 20, 1],
              columns: [
                {
                  width: '40%',
                  stack: [
                    { text: 'ORIGEN', fontSize: 7, color: '#666666', margin: [0, 0, 0, 1] },
                    { text: data.payerName, fontSize: 11, bold: true },
                  ]
                },
                {
                  width: '20%',
                  text: '────►',
                  fontSize: 10,
                  color: '#999999',
                  alignment: 'center',
                  margin: [0, 8, 0, 0]
                },
                {
                  width: '40%',
                  stack: [
                    { text: 'DESTINO', fontSize: 7, color: '#666666', margin: [0, 0, 0, 1] },
                    { text: data.receiverName, fontSize: 11, bold: true },
                  ]
                }
              ]
            },
            
            // SEPARATOR
            {
              canvas: [{ type: 'line', x1: 0, y1: 0, x2: 356, y2: 0, lineWidth: 0.5, lineColor: '#CCCCCC' }],
              margin: [0, 1, 0, 1],
            },
            
            // AMOUNT
            {
              margin: [20, 1, 20, 1],
              stack: [
                { text: 'MONTO TRANSFERIDO', fontSize: 7, color: '#666666', margin: [0, 0, 0, 1] },
                { text: `Bs ${data.amountNumeric.replace('.', ',')}`, fontSize: 16, bold: true, margin: [0, 0, 0, 2] },
                { text: `SON: ${data.amountLiteral}`, fontSize: 8 }
              ]
            },
            
            // SEPARATOR
            {
              canvas: [{ type: 'line', x1: 0, y1: 0, x2: 356, y2: 0, lineWidth: 0.5, lineColor: '#CCCCCC' }],
              margin: [0, 1, 0, 1],
            },
            
            // CONCEPT
            {
              margin: [20, 1, 20, 1],
              stack: [
                { text: 'CONCEPTO', fontSize: 7, color: '#666666', margin: [0, 0, 0, 1] },
                { text: data.concept, fontSize: 9 }
              ]
            },
            
            // SEPARATOR
            {
              canvas: [{ type: 'line', x1: 0, y1: 0, x2: 356, y2: 0, lineWidth: 0.5, lineColor: '#CCCCCC' }],
              margin: [0, 1, 0, 1],
            },
            
          ]
        }
      ]
    },

    // SIGNATURES
    {
      absolutePosition: { x: 20, y: startY + 215 },
      columns: [
        {
          width: 356,
          stack: [
            {
              columns: [
                {
                  width: 120,
                  stack: [
                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 120, y2: 0, lineWidth: 1 }] },
                    { text: 'ENTREGUÉ CONFORME', fontSize: 6, bold: true, alignment: 'center', margin: [0, 4, 0, 2] },
                    { text: data.payerName, fontSize: 6, alignment: 'center' }
                  ],
                },
                { width: '*', text: '' },
                {
                  width: 120,
                  stack: [
                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 120, y2: 0, lineWidth: 1 }] },
                    { text: 'RECIBÍ CONFORME', fontSize: 6, bold: true, alignment: 'center', margin: [0, 4, 0, 2] },
                    { text: data.receiverName, fontSize: 6, alignment: 'center' }
                  ],
                }
              ],
              margin: [20, 0, 20, 0]
            }
          ]
        }
      ]
    },

    // FOOTER
    {
      absolutePosition: { x: 20, y: startY + 244 },
      columns: [
        {
          width: 356,
          stack: [footerSection()],
        },
      ],
    },
  ];
};
