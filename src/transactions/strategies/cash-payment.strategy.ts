import { TransactionStatus } from 'src/generated/prisma/client';
import { IPaymentStrategy, PaymentResult } from './payment-strategy.interface';

export class CashPaymentStrategy implements IPaymentStrategy {
  async processPayment(amount: number): Promise<PaymentResult> {
    // El pago en efectivo es inmediato y síncrono
    return {
      transactionStatus: TransactionStatus.COMPLETED,
    };
  }
}
