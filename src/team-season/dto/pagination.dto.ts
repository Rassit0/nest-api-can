// modules/disciplines/dto/discipline-pagination.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import {
  ProgramGender,
  SeasonStatus,
  StatusTeamSeason,
} from 'src/generated/prisma/enums';

export class TeamCategorySeasonsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'createdAt',
    enum: ['createdAt'],
  })
  @IsOptional()
  @IsIn(['createdAt'], {
    message: 'Columnas permitidas: createdAt',
  })
  sortField?: string = 'createdAt'; // Valor por defecto para este módulo

  @ApiPropertyOptional({
    // example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar por equipo',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'teamId',
    }),
  })
  @Exists('team', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'teamId',
    }),
  })
  @IsOptional()
  teamId?: string;

  @ApiPropertyOptional({
    // example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar por categoría',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'categoryId',
    }),
  })
  @Exists('category', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'categoryId',
    }),
  })
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    // example: 'name',
    enum: ProgramGender,
    description: 'Filtrar por género del programa',
  })
  @IsEnum(ProgramGender, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'ProgramGender',
    }),
  })
  @IsOptional()
  gender?: ProgramGender;

  @ApiPropertyOptional({
    // example: 'name',
    enum: StatusTeamSeason,
    description:
      'Filtrar por estado de la temporada (DRAFT, ACTIVE, FINISHED, CANCELLED)',
  })
  @IsEnum(StatusTeamSeason, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'StatusTeamSeason',
    }),
  })
  @IsOptional()
  status?: StatusTeamSeason;
}
