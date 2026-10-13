export interface TransactionReceiptData {
  receiptSeries: string;
  receiptNumber: string;
  date: Date;
  payerName: string;
  payerDocument: string;
  beneficiaryName?: string;
  amountLiteral: string;
  amountNumeric: string;
  concept: string;
  paymentMethod: string;
  receiverName: string;
  receiverDocument: string;
  validationUrl?: string | null;
  type: 'INCOME' | 'EXPENSE' | 'INTERNAL_TRANSFER';
  isPartialPayment?: boolean;
  beneficiaryId?: string;
  payerId?: string;
}
