import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class StudentsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'createdAt',
    enum: ['createdAt', 'isActive', 'id'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'isActive', 'id'], {
    message: 'Columnas permitidas: createdAt, isActive, id',
  })
  sortField?: string = 'createdAt';
}
