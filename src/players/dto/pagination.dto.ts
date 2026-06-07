// modules/disciplines/dto/discipline-pagination.dto.ts
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class PlayerPaginationDto extends PaginationDto {
  @IsOptional()
  @IsIn(['name', 'createdAt', 'id'], {
    message: 'Columnas permitidas: name, createdAt, id',
  })
  sortField?: string = 'name'; // Valor por defecto para este módulo
}
