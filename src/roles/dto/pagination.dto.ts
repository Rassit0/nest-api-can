import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class RolesPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'name',
    enum: ['name', 'createdAt', 'id'],
  })
  @IsOptional()
  @IsIn(['name', 'createdAt', 'id'], {
    message: 'Columnas permitidas: name, createdAt, id',
  })
  sortField?: string = 'name';
}
