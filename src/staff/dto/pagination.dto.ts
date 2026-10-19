import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class StaffPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'name',
    enum: [
      'name',
      'lastName',
      'secondLastName',
      'documentNumber',
      'birthDate',
      'phone',
      'gender',
      'createdAt',
      'isActive',
      'id',
    ],
  })
  @IsOptional()
  @IsIn(
    [
      'name',
      'lastName',
      'secondLastName',
      'documentNumber',
      'birthDate',
      'phone',
      'gender',
      'createdAt',
      'isActive',
      'id',
    ],
    {
      message:
        'Columnas permitidas: name, lastName, secondLastName, documentNumber, birthDate, phone, gender, createdAt, isActive, id',
    },
  )
  sortField?: string = 'name';

  @ApiPropertyOptional({
    description: 'Filtro por estado de actividad del personal',
    enum: ['ALL', 'ACTIVE', 'INACTIVE'],
    default: 'ALL',
  })
  @IsOptional()
  @IsIn(['ALL', 'ACTIVE', 'INACTIVE', 'all', 'active', 'inactive'], {
    message: 'El estado debe ser ALL, ACTIVE o INACTIVE',
  })
  status?: string;
}
