import { Transaction, ChargeTransaction, Charge, Prisma } from 'src/generated/prisma/client';

export type TransactionWithRelations = Prisma.TransactionGetPayload<{
  select: typeof import('./transactions.service').transactionSelect;
}>;

export interface MappedTransaction {
  id: string;
  type: string;
  amount: number;
  concept: string;
  category: string | null;
  origin: string;
  paymentMethod: string;
  transactionDate: Date;
  status: string;
  receiptSeries: string;
  receiptNumber: number;
  reference: string | null;
  financialAccountName: string | null;
  thirdParty: {
    id: string;
    name: string;
    documentNumber: string | null;
  } | null;
  attachments: {
    id: string;
    originalName: string;
    url: string | null;
    mimeType: string;
    sizeBytes: number;
  }[];
  createdAt: Date;
}

export class TransactionsMapper {
  static toDomain(transaction: TransactionWithRelations): MappedTransaction {
    // Definir valores por defecto
    let concept = transaction.description || 'Movimiento sin concepto';
    let category = null;
    let origin = 'UNKNOWN';

    // Resolver contexto a partir del cargo principal pagado (si lo hay)
    if (transaction.chargeTransactions && transaction.chargeTransactions.length > 0) {
      // Tomamos el primer cargo como referencia principal del movimiento
      const mainCharge = transaction.chargeTransactions[0].charge as any;

      if (mainCharge.accountCharge) {
        origin = 'ACCOUNT_CHARGE';
        concept = mainCharge.accountCharge.title || mainCharge.description || concept;
        category = mainCharge.accountCharge.category?.name || null;
      } else if (mainCharge.membershipCharges && mainCharge.membershipCharges.length > 0) {
        origin = 'MEMBERSHIP';
        concept = mainCharge.description || 'Pago de Membresía';
        category = 'Membresías'; // Categoría por defecto para membresías
      } else if (mainCharge.studentCharges && mainCharge.studentCharges.length > 0) {
        origin = 'STUDENT';
        concept = mainCharge.description || 'Pago de Colegiatura';
        category = 'Academia';
      } else if (mainCharge.sessionBooking) {
        origin = 'BOOKING';
        concept = mainCharge.description || 'Reserva de Cancha';
        category = 'Reservas';
      } else {
        origin = 'GENERIC_CHARGE';
        concept = mainCharge.description || concept;
      }
    }

    return {
      id: transaction.id,
      type: transaction.type,
      amount: Number(transaction.amount),
      concept,
      category,
      origin,
      paymentMethod: transaction.paymentMethod,
      transactionDate: transaction.transactionDate,
      status: transaction.status,
      receiptSeries: transaction.receiptSeries,
      receiptNumber: transaction.receiptNumber,
      reference: transaction.reference,
      financialAccountName: (transaction as any).financialAccount?.name || null,
      thirdParty: transaction.thirdParty || null,
      attachments: transaction.attachments || [],
      createdAt: transaction.createdAt,
    };
  }
}
