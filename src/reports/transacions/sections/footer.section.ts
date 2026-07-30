import { Content, ContextPageSize } from 'pdfmake/interfaces';

export const footerSection = (
  currentPage?: number,
  pageCount?: number,
  pageSize?: ContextPageSize,
): Content => {
  return {
    text: '¡Gracias por confiar en nosotros!  #SOMOSCAN #SOMOSORURO',
    alignment: 'center',
    fontSize: 7, // reducido de 8
    bold: true,
    margin: [0, 3, 0, 0], // reducido de 4
  };
};
