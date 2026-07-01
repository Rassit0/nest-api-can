import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class PermissionsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'name',
    enum: ['name', 'module', 'createdAt', 'id'],
  })
  @IsOptional()
  @IsIn(['name', 'module', 'createdAt', 'id'], {
    message: 'Columnas permitidas: name, module, createdAt, id',
  })
  sortField?: string = 'name';
}
