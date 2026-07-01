import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class StudentChargesPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'createdAt',
    enum: ['createdAt', 'billingYear', 'billingMonth', 'type', 'id'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'billingYear', 'billingMonth', 'type', 'id'], {
    message:
      'Columnas permitidas: createdAt, billingYear, billingMonth, type, id',
  })
  sortField?: string = 'createdAt';
}
