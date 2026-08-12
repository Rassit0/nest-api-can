import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTransactionDto } from './create-transaction.dto';

export class UpdateTransactionDto extends PartialType(
  OmitType(CreateTransactionDto, [
    'payerPersonId',
    'amount',
    'type',
    'chargeId',
    'splitTransactions',
    'paymentMethod',
    'transactionDate',
  ] as const),
) {}
