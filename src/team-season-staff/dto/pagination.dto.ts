// modules/disciplines/dto/discipline-pagination.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { TeamSeasonStaffRole } from 'src/generated/prisma/enums';

export class TeamSeasonStaffPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'createdAt',
    enum: ['createdAt', 'id'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'id'], {
    message: i18nValidationMessage('validation.IS_IN', {
      validValues: 'createdAt, id',
    }),
  })
  sortField?: string = 'createdAt';

  @ApiPropertyOptional({
    // example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar por temporada del equipo',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {}),
  })
  @Exists('teamSeason', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'teamSeasonId',
    }),
  })
  @IsOptional()
  teamSeasonId: string;

  @ApiPropertyOptional({
    // example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar por personal',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {}),
  })
  @Exists('staff', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'staffId',
    }),
  })
  @IsOptional()
  staffId: string;

  @ApiPropertyOptional({
    // example: 'name',
    enum: TeamSeasonStaffRole,
    description: 'Filtrar por rol',
  })
  @IsEnum(TeamSeasonStaffRole, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'role',
    }),
  })
  @IsOptional()
  role?: TeamSeasonStaffRole;
}
