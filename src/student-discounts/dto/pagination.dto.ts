import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class StudentDiscountsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'createdAt',
    enum: ['startDate', 'createdAt', 'type', 'id'],
  })
  @IsOptional()
  @IsIn(['startDate', 'createdAt', 'type', 'id'], {
    message: 'Columnas permitidas: startDate, createdAt, type, id',
  })
  sortField?: string = 'createdAt';
}
