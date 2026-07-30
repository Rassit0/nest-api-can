import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateFinancialAccountDto } from './create-financial-account.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateFinancialAccountDto extends PartialType(CreateFinancialAccountDto) {
  @ApiPropertyOptional({ description: 'Indica si la cuenta está activa', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
