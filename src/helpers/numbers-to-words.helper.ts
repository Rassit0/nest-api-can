export function convertAmountToWords(amount: number): string {
  if (amount === 0) return 'Cero 00/100 bolivianos';

  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  const words = integerToWords(integerPart);
  const decimalString = decimalPart.toString().padStart(2, '0');

  // Capitalize the first letter
  const capitalizedWords = words.charAt(0).toUpperCase() + words.slice(1);

  return `${capitalizedWords} ${decimalString}/100 bolivianos`;
}

function integerToWords(num: number): string {
  if (num === 0) return 'cero';

  const unities = [
    '',
    'un',
    'dos',
    'tres',
    'cuatro',
    'cinco',
    'seis',
    'siete',
    'ocho',
    'nueve',
  ];
  const tens = [
    '',
    'diez',
    'veinte',
    'treinta',
    'cuarenta',
    'cincuenta',
    'sesenta',
    'setenta',
    'ochenta',
    'noventa',
  ];
  const teens = [
    'diez',
    'once',
    'doce',
    'trece',
    'catorce',
    'quince',
    'dieciséis',
    'diecisiete',
    'dieciocho',
    'diecinueve',
  ];
  const twenties = [
    'veinte',
    'veintiún',
    'veintidós',
    'veintitrés',
    'veinticuatro',
    'veinticinco',
    'veintiséis',
    'veintisiete',
    'veintiocho',
    'veintinueve',
  ];
  const hundreds = [
    '',
    'ciento',
    'doscientos',
    'trescientos',
    'cuatrocientos',
    'quinientos',
    'seiscientos',
    'setecientos',
    'ochocientos',
    'novecientos',
  ];

  if (num === 100) return 'cien';

  let result = '';

  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    if (thousands === 1) {
      result += 'mil ';
    } else {
      result += integerToWords(thousands) + ' mil ';
    }
    num %= 1000;
  }

  if (num >= 100) {
    const hundred = Math.floor(num / 100);
    result += hundreds[hundred] + ' ';
    num %= 100;
  }

  if (num >= 30) {
    const ten = Math.floor(num / 10);
    result += tens[ten];
    num %= 10;
    if (num > 0) result += ' y ';
  } else if (num >= 20) {
    result += twenties[num - 20];
    num = 0;
  } else if (num >= 10) {
    result += teens[num - 10];
    num = 0;
  }

  if (num > 0) {
    result += unities[num];
  }

  return result.trim();
}
