import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class AccountCategoriesPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Tipo de categoría (RECEIVABLE, PAYABLE)',
  })
  @IsOptional()
  @IsString()
  type?: string;
}
