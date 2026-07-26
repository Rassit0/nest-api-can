export interface TransactionReceiptData {
  receiptNumber: string;
  date: Date;
  payerName: string;
  payerDocument: string;
  amountLiteral: string;
  amountNumeric: string;
  concept: string;
  paymentMethod: string;
  receiverName: string;
  receiverDocument: string;
  validationUrl: string;
}
