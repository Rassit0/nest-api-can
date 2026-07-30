import { PartialType } from '@nestjs/swagger';
import { CreateAccountChargeDto } from './create-account-charge.dto';
import { OmitType } from '@nestjs/swagger';

export class UpdateAccountChargeDto extends PartialType(
  OmitType(CreateAccountChargeDto, ['amount', 'direction'] as const)
) {}
