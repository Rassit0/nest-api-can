import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, IsEnum, IsISO8601 } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';
import { StudentMembershipStatus } from '../../generated/prisma/enums';

export class StudentMembershipsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'lastName',
    enum: ['startedAt', 'status', 'createdAt', 'id', 'lastName'],
  })
  @IsOptional()
  @IsIn(['startedAt', 'status', 'createdAt', 'id', 'lastName'], {
    message: 'Columnas permitidas: startedAt, status, createdAt, id, lastName',
  })
  sortField?: string = 'lastName';

  @ApiPropertyOptional({
    description: 'Filtrar por curso de la temporada',
  })
  @IsUUID('4')
  @IsOptional()
  courseSeasonId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por turno específico de la temporada',
  })
  @IsUUID('4')
  @IsOptional()
  courseSeasonShiftId?: string;

  @ApiPropertyOptional({
    description: 'Fecha física para consultar la asistencia al turno en formato ISO 8601 UTC (ej. 2026-09-01T15:30:00.000Z)',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'physicalDate debe ser una cadena ISO 8601 válida' })
  physicalDate?: string;

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

  @ApiPropertyOptional({
    description: 'Filtrar por plan de pago',
  })
  @IsUUID('4')
  @IsOptional()
  paymentPlanId?: string;
}
