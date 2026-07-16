import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class StudentsPaginationDto extends PaginationDto {
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
      'id',
    ],
    {
      message:
        'Columnas permitidas: name, lastName, secondLastName, documentNumber, birthDate, phone, gender, createdAt, id',
    },
  )
  sortField?: string = 'name';
}
