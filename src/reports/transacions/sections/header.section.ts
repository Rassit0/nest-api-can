import type { Content, Column } from 'pdfmake/interfaces';

interface HeaderOptions {
  receiptNumber: string;
  date: Date;
}

export const headerSection = (options: HeaderOptions): Content => {
  const { receiptNumber, date } = options;
  const title = 'APORTE VOLUNTARIO';

  const logo: Content = {
    image: path.join(process.cwd(), 'dist', 'assets', 'logo-can.png'),
    width: 40,
    margin: [0, 0, 10, 0],
  };

  const clubInfo: Content = {
    stack: [
      { text: 'CLUB ATLÉTICO NACIONAL', bold: true, fontSize: 9 },
      {
        text: 'FUNDADO EL 17 DE OCTUBRE DE 1935',
        fontSize: 6,
        margin: [0, 2, 0, 1],
      },
      {
        text: 'DIR: 6 de octubre y Rodriguez\n(Parque de la Unión Naciona)\nORURO - BOLIVIA',
        fontSize: 6,
        lineHeight: 1.1,
      },
    ],
    margin: [10, 5, 0, 0],
  };

  const boxLayout = {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => '#000000',
    vLineColor: () => '#000000',
    paddingTop: () => 3,
    paddingBottom: () => 3,
  };

  const receiptInfo: Content = {
    stack: [
      {
        text: title,
        bold: true,
        fontSize: 12,
        alignment: 'right',
        margin: [0, 0, 30, 5],
      },
      {
        columns: [
          {
            stack: [
              {
                text: 'No.:',
                fontSize: 7,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 2],
              },
              {
                stack: [
                  {
                    canvas: [
                      {
                        type: 'rect',
                        x: 0,
                        y: 0,
                        w: 92,
                        h: 14,
                        r: 4,
                        lineWidth: 0.5,
                      },
                    ],
                  },
                  {
                    text: receiptNumber,
                    alignment: 'center',
                    fontSize: 8,
                    margin: [0, -11, 0, 0],
                  },
                ],
              },
            ],
            width: 'auto',
            margin: [0, 0, 5, 0],
          },
          {
            stack: [
              {
                text: 'FECHA DE EMISIÓN:',
                fontSize: 7,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 2],
              },
              {
                stack: [
                  {
                    canvas: [
                      {
                        type: 'rect',
                        x: 0,
                        y: 0,
                        w: 92,
                        h: 14,
                        r: 4,
                        lineWidth: 0.5,
                      },
                    ],
                  },
                  {
                    text: date.toLocaleDateString('es-BO'),
                    alignment: 'center',
                    fontSize: 8,
                    margin: [0, -11, 0, 0],
                  },
                ],
              },
            ],
            width: 'auto',
          },
        ],
        alignment: 'right',
        margin: [0, 0, 30, 5],
      },
    ],
  };

  return {
    columns: [
      {
        width: 50,
        ...logo,
      },
      {
        width: '*',
        ...clubInfo,
      },
      {
        width: 180,
        ...receiptInfo,
      },
    ],
    margin: [20, 15, 25, 10],
  };
};
