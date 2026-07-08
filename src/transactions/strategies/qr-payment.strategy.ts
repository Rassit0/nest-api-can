import { TransactionStatus } from 'src/generated/prisma/client';
import { IPaymentStrategy, PaymentResult } from './payment-strategy.interface';

export class QrPaymentStrategy implements IPaymentStrategy {
  async processPayment(amount: number): Promise<PaymentResult> {
    // TODO: Implementar llamada real a la API del Banco para generar el QR
    // const bankResponse = await this.bankService.generateQr(amount);
    
    // Por ahora simulamos la generación del QR y dejamos la transacción pendiente
    return {
      transactionStatus: TransactionStatus.PENDING,
      providerResponse: {
        message: 'QR generado exitosamente (Simulado)',
        qrBase64: 'data:image/png;base64,iVBORw0KGgo...', // Simulación
        intentId: 'INTENT-123456',
      },
    };
  }
}
