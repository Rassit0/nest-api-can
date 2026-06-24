// modules/disciplines/dto/discipline-pagination.dto.ts
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class StaffPaginationDto extends PaginationDto {
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
      'id',
    ],
    {
      message:
        'Columnas permitidas: name, lastname, secondLastName, documentNumber, birthDate, phone, gender, createdAt, id',
    },
  )
  sortField?: string = 'name'; // Valor por defecto para este módulo
}
