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

export class PermissionsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID de rol',
  })
  @IsOptional()
  roleId?: string;

  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'module',
    enum: ['name', 'module', 'id'],
  })
  @IsOptional()
  @IsIn(['name', 'module', 'id'], {
    message: 'Columnas permitidas: name, module, id',
  })
  sortField?: string = 'module';
}
