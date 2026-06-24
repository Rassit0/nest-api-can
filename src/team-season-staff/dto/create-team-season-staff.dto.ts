import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { TeamSeasonStaffRole } from 'src/generated/prisma/enums';

export class CreateTeamSeasonStaffDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la temporada del equipo',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'teamSeasonId',
    }),
  })
  @Exists('teamSeason', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'teamSeasonId',
    }),
  })
  teamSeasonId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la temporada del equipo',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'staffId',
    }),
  })
  @Exists('staff', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'staffId',
    }),
  })
  staffId: string;

  @ApiProperty({
    // example: TeamSeasonStaffRole.,
    enum: TeamSeasonStaffRole,
    description: 'Rol del personal de la temporada del equipo',
  })
  @IsEnum(TeamSeasonStaffRole, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'role',
    }),
  })
  role: TeamSeasonStaffRole;

  @ApiProperty({
    example: 'U-13',
    description: 'Descripción del rol, obligatorío si el rol es Otro',
  })
  @ValidateIf((o) => o.role === TeamSeasonStaffRole.OTHER)
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'customRole',
    }),
  })
  @MinLength(3, {
    message: i18nValidationMessage('validation.MIN_LENGTH', {
      constraint1: 'customRole',
      constraint2: 3,
    }),
  })
  customRole?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de inicio de la temporada (formato ISO 8601)',
  })
  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  )
  startedAt: string;

  @ApiProperty({
    example: 'Notas adicionales sobre el personal de la temporada del equipo',
    description:
      'Notas adicionales sobre el personal de la temporada del equipo',
    required: false,
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'notes',
    }),
  })
  @MinLength(3, {
    message: i18nValidationMessage('validation.MIN_LENGTH', {
      constraint1: 'notes',
      constraint2: 3,
    }),
  })
  @IsOptional()
  notes?: string;
}
