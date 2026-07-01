import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { TeamSeasonStaffRole } from 'src/generated/prisma/client';

export class CreateCourseSeasonStaffDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del periodo del curso (CourseSeason)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'courseSeasonId',
    }),
  })
  @Exists('courseSeason', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'courseSeasonId',
    }),
  })
  courseSeasonId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del miembro del personal (Staff)',
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
    enum: TeamSeasonStaffRole,
    example: TeamSeasonStaffRole.HEAD_COACH,
    description:
      'Rol del personal en el curso (HEAD_COACH, ASSISTANT_COACH, ASSISTANT, VOLUNTEER, DELEGATE, OTHER)',
  })
  @IsEnum(TeamSeasonStaffRole, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'role',
    }),
  })
  role: TeamSeasonStaffRole;

  @ApiPropertyOptional({
    example: 'Coordinador Técnico',
    description: 'Rol personalizado si se selecciona OTHER',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'customRole',
    }),
  })
  customRole?: string | null;

  @ApiProperty({
    example: '2026-06-30T00:00:00.000Z',
    description: 'Fecha de inicio de funciones',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'startedAt',
    }),
  })
  @IsDate({
    message: i18nValidationMessage('validation.IS_DATE', {
      constraint1: 'startedAt',
    }),
  })
  @Type(() => Date)
  startedAt: Date;

  @ApiPropertyOptional({
    example: '2026-12-31T00:00:00.000Z',
    description: 'Fecha de fin de funciones',
    nullable: true,
  })
  @IsOptional()
  @IsDate({
    message: i18nValidationMessage('validation.IS_DATE', {
      constraint1: 'endedAt',
    }),
  })
  @Type(() => Date)
  endedAt?: Date | null;

  @ApiPropertyOptional({
    example: true,
    description:
      'Indica si este miembro del personal es el profesor encargado principal',
    default: false,
  })
  @IsOptional()
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'isPrimary',
    }),
  })
  @Type(() => Boolean)
  isPrimary?: boolean = false;

  @ApiPropertyOptional({
    example: 'Solo disponible para el turno mañana',
    description: 'Comentarios adicionales',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'notes',
    }),
  })
  notes?: string | null;
}
