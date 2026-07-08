import { TransactionStatus } from 'src/generated/prisma/client';
import { IPaymentStrategy, PaymentResult } from './payment-strategy.interface';

export class TransferPaymentStrategy implements IPaymentStrategy {
  async processPayment(amount: number): Promise<PaymentResult> {
    // La transferencia manual también es síncrona en este contexto (ya fue verificada por el cajero)
    return {
      transactionStatus: TransactionStatus.COMPLETED,
    };
  }
}
