import type {
  Content,
  TDocumentDefinitions,
  PageSize,
} from 'pdfmake/interfaces';
import { headerSection } from './sections/header.section';
import { footerSection } from './sections/footer.section';

import { TransactionReceiptData } from './interfaces/transaction-receipt-data.interface';

interface ReportOptions {
  data: TransactionReceiptData;
  pageSize?: PageSize;
}

export const transactionByIdReport = (
  options: ReportOptions,
): TDocumentDefinitions => {
  const { data, pageSize = { width: 396, height: 306 } } = options;

  return {
    pageSize,
    pageMargins: [20, 85, 20, 30], // [izq, arriba, der, abajo] - Reducido el margen superior a 85 para dar más espacio

    // Fondo y borde redondeado
    background: [
      {
        canvas: [
          // 1. Caja gris redondeada para el fondo del footer
          {
            type: 'rect',
            x: 11, // 1 punto adentro del borde negro
            y: 277, // A la altura exacta del footer
            w: 374, // Ancho interior exacto
            h: 18, // Alto para llegar hasta el borde inferior
            r: 4, // Radio ligeramente menor para que encaje perfecto en las esquinas
            color: '#EBEBEB',
          },
          // 2. Borde exterior negro redondeado
          {
            type: 'rect',
            x: 10,
            y: 10,
            w: 376,
            h: 286,
            r: 5,
            lineWidth: 1,
            lineColor: '#000000',
          },
        ],
      },
    ],

    header: headerSection({
      receiptNumber: data.receiptNumber,
      date: data.date,
    }),

    content: [
      // Caja gris del medio (Descripción y Monto)
      {
        table: {
          widths: ['*', 130],
          body: [
            [
              // Columna Izquierda: Descripción
              {
                stack: [
                  {
                    canvas: [
                      // El ancho es ~226px (356 total - 130 columna derecha)
                      {
                        type: 'rect',
                        x: 0,
                        y: 0,
                        w: 226,
                        h: 115,
                        r: 4,
                        color: '#EBEBEB',
                      },
                    ],
                  },
                  // Insertamos la marca de agua aquí para que se dibuje SOBRE la caja gris pero DEBAJO del texto
                  {
                    image: 'src/assets/logo-can-negro.png',
                    width: 190,
                    opacity: 0.1,
                    absolutePosition: { x: 180, y: 20 },
                  },
                  {
                    stack: [
                      {
                        text: 'DESCRIPCIÓN',
                        bold: true,
                        fontSize: 10,
                        margin: [0, 0, 0, 3],
                      },
                      { text: 'Recibí de:', fontSize: 8, bold: true },
                      {
                        text: data.payerName,
                        fontSize: 9,
                        margin: [0, 0, 0, 3],
                      },
                      { text: 'La suma de:', fontSize: 8, bold: true },
                      {
                        text: data.amountLiteral,
                        fontSize: 9,
                        margin: [0, 0, 0, 3],
                      },
                      { text: 'Por concepto de:', fontSize: 8, bold: true },
                      {
                        text: data.concept,
                        fontSize: 9,
                      },
                    ],
                    // Tiramos el texto hacia arriba para que quede sobre el canvas gris
                    margin: [10, -105, 10, 5],
                  },
                ],
                border: [false, false, false, false],
              },

              // Columna Derecha: Monto y Forma de Pago
              {
                stack: [
                  {
                    text: 'MONTO:',
                    bold: true,
                    fontSize: 10,
                    alignment: 'right',
                    margin: [0, 0, 0, 3],
                  },
                  {
                    // Caja de monto con bordes redondeados usando canvas
                    stack: [
                      // Dibujamos la caja alineada a la derecha. El ancho total disponible es ~110px.
                      {
                        canvas: [
                          {
                            type: 'rect',
                            x: 20,
                            y: 0,
                            w: 90,
                            h: 20,
                            r: 4,
                            lineWidth: 0.5,
                          },
                        ],
                      },
                      {
                        text: `${data.amountNumeric} Bs.`,
                        alignment: 'right',
                        fontSize: 11,
                        bold: true,
                        margin: [0, -15, 10, 0],
                      },
                    ],
                    margin: [0, 0, 0, 8],
                  },
                  {
                    text: 'FORMA DE PAGO:',
                    fontSize: 8,
                    bold: true,
                    alignment: 'right',
                  },
                  {
                    text: data.paymentMethod,
                    fontSize: 9,
                    bold: true,
                    alignment: 'right',
                  },
                  {
                    qr: data.validationUrl,
                    fit: 65,
                    alignment: 'right',
                    margin: [0, 10, 5, 0],
                  },
                ],
                margin: [10, 5, 10, 5],
                border: [false, false, false, false],
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 5], // Reducido el espacio vertical
      },

      // Firmas
      {
        columns: [
          {
            // Firma Izquierda
            width: 120,
            stack: [
              {
                canvas: [
                  { type: 'line', x1: 0, y1: 0, x2: 120, y2: 0, lineWidth: 1 },
                ],
              },
              {
                text: 'ENTREGUÉ CONFORME',
                fontSize: 7,
                bold: true,
                alignment: 'center',
                margin: [0, 2, 0, 0],
              },
              {
                text: data.payerName,
                fontSize: 6,
                alignment: 'center',
              },
              {
                text: `C.I. ${data.payerDocument}`,
                fontSize: 6,
                alignment: 'center',
              },
            ],
          },
          {
            // Espaciador flexible al centro
            width: '*',
            text: '',
          },
          {
            // Firma Derecha
            width: 120,
            stack: [
              {
                canvas: [
                  { type: 'line', x1: 0, y1: 0, x2: 120, y2: 0, lineWidth: 1 },
                ],
              },
              {
                text: 'RECIBÍ CONFORME',
                fontSize: 7,
                bold: true,
                alignment: 'center',
                margin: [0, 2, 0, 0],
              },
              {
                text: data.receiverName,
                fontSize: 6,
                alignment: 'center',
              },
              {
                text: `C.I. ${data.receiverDocument}`,
                fontSize: 6,
                alignment: 'center',
              },
            ],
          },
        ],
        // Ajustamos márgenes para que todo el bloque quede simétrico y bien posicionado
        margin: [30, 25, 30, 0],
      },
    ],

    // Delegamos la sección inferior a nuestro nuevo footer.section.ts
    footer: footerSection,
  };
};
