import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccountReferenceType, ChargeDirection, PaymentMethod } from 'src/generated/prisma/client';
import { ValidateNested } from 'class-validator';

export class ImmediatePaymentDto {
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @IsString()
  @IsNotEmpty()
  financialAccountId: string;

  @IsOptional()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsUUID('4')
  payerPersonId?: string;

  @IsOptional()
  @Type(() => Date)
  transactionDate?: Date;
}

export class CreateAccountChargeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @Type(() => Date)
  @IsNotEmpty()
  dueDate: Date;

  @IsEnum(ChargeDirection)
  @IsNotEmpty()
  direction: ChargeDirection;

  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsEnum(AccountReferenceType)
  @IsOptional()
  referenceType?: AccountReferenceType;

  @IsString()
  @IsOptional()
  referenceId?: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsUUID()
  @IsOptional()
  personId?: string;

  @IsString()
  @IsOptional()
  externalEntity?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImmediatePaymentDto)
  immediatePayment?: ImmediatePaymentDto;
}
