import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class SessionIncidentsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'createdAt',
    enum: ['createdAt', 'id'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'id'], {
    message: 'Columnas permitidas: createdAt, id',
  })
  sortField?: string = 'createdAt';
}
