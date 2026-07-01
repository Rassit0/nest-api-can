import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';
import { StudentMembershipStatus } from '../../generated/prisma/enums';

export class StudentMembershipsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'createdAt',
    enum: ['startedAt', 'status', 'createdAt', 'id'],
  })
  @IsOptional()
  @IsIn(['startedAt', 'status', 'createdAt', 'id'], {
    message: 'Columnas permitidas: startedAt, status, createdAt, id',
  })
  sortField?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Filtrar por curso de la temporada',
  })
  @IsUUID('4')
  @IsOptional()
  courseSeasonId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estudiante',
  })
  @IsUUID('4')
  @IsOptional()
  studentId?: string;

  @ApiPropertyOptional({
    enum: StudentMembershipStatus,
    description: 'Filtrar por estado de membresía',
  })
  @IsEnum(StudentMembershipStatus)
  @IsOptional()
  status?: StudentMembershipStatus;
}
