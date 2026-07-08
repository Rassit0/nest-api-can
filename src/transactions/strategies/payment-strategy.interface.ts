import { TransactionStatus } from 'src/generated/prisma/client';

export interface PaymentResult {
  transactionStatus: TransactionStatus;
  providerResponse?: any; // Datos extra devueltos por el proveedor (ej. QR base64)
}

export interface IPaymentStrategy {
  processPayment(amount: number, metadata?: any): Promise<PaymentResult>;
}
