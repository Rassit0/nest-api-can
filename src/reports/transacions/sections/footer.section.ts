import { Content, ContextPageSize } from 'pdfmake/interfaces';

export const footerSection = (
  currentPage?: number,
  pageCount?: number,
  pageSize?: ContextPageSize,
): Content => {
  return {
    text: '¡Gracias por confiar en nosotros!  #SOMOSCAN #SOMOSORURO',
    alignment: 'center',
    fontSize: 8,
    bold: true,
    margin: [0, 4, 0, 0], // Pequeño margen para centrar verticalmente sobre el fondo gris dibujado
  };
};
