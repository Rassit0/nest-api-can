import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class ChargesPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'createdAt',
    enum: ['createdAt', 'dueDate', 'amount', 'status', 'id'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'dueDate', 'amount', 'status', 'id'], {
    message: 'Columnas permitidas: createdAt, dueDate, amount, status, id',
  })
  sortField?: string = 'createdAt';

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar por membresía de jugador',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {}),
  })
  @Exists('playerMembership', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'playerMembershipId',
    }),
  })
  @IsOptional()
  playerMembershipId: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Filtrar por membresía de estudiante',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {}),
  })
  @Exists('studentMembership', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'studentMembershipId',
    }),
  })
  @IsOptional()
  studentMembershipId?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'Filtrar por membresías de una temporada de equipo',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {}),
  })
  @IsOptional()
  teamSeasonId?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440003',
    description: 'Filtrar por membresías de una temporada de curso',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {}),
  })
  @IsOptional()
  courseSeasonId?: string;
}
