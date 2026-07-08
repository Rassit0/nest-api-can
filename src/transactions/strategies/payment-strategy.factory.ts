import { PaymentMethod } from 'src/generated/prisma/client';
import { IPaymentStrategy } from './payment-strategy.interface';
import { CashPaymentStrategy } from './cash-payment.strategy';
import { TransferPaymentStrategy } from './transfer-payment.strategy';
import { QrPaymentStrategy } from './qr-payment.strategy';

export class PaymentStrategyFactory {
  static getStrategy(method: PaymentMethod): IPaymentStrategy {
    switch (method) {
      case PaymentMethod.CASH:
        return new CashPaymentStrategy();
      case PaymentMethod.TRANSFER:
        return new TransferPaymentStrategy();
      case PaymentMethod.QR:
        return new QrPaymentStrategy();
      default:
        throw new Error(`Strategy for payment method ${method} not implemented.`);
    }
  }
}
