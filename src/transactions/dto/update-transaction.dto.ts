import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTransactionDto } from './create-transaction.dto';

export class UpdateTransactionDto extends PartialType(
  OmitType(CreateTransactionDto, [
    'payerPersonId',
    'amount',
    'type',
    'chargeTransactions',
    'paymentMethod',
    'transactionDate',
  ] as const),
) {}
