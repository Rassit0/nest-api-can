import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class ChargesPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'createdAt',
    enum: ['createdAt', 'dueDate', 'amount', 'status', 'id'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'dueDate', 'amount', 'status', 'id'], {
    message: 'Columnas permitidas: createdAt, dueDate, amount, status, id',
  })
  sortField?: string = 'createdAt';
}
