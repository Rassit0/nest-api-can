import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { IsAfter } from 'src/common/validators/decorators/is-after.decorator';
import { ProgramGender } from 'src/generated/prisma/client';

export class AddShiftDto {
  @ApiProperty({
    description: 'El ID del nuevo turno a agregar',
    example: 'uuid',
  })
  @IsNotEmpty({ message: 'El ID del turno es requerido' })
  @IsUUID('4', { message: 'El ID del turno debe ser un UUID válido' })
  @Exists('shift', 'id', { message: 'El turno proporcionado no existe' })
  shiftId: string;

  @ApiProperty({
    example: 30,
    description: 'Número máximo de estudiantes permitidos',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'maxMembers',
    }),
  })
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'maxMembers',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'maxMembers',
      constraint2: 1,
    }),
  })
  @IsAfter('minMembers', {
    message: i18nValidationMessage('validation.IS_AFTER', {
      constraint1: 'minMembers',
    }),
  })
  @Type(() => Number)
  maxMembers: number;

  @ApiProperty({
    example: 5,
    description: 'Número mínimo de estudiantes necesarios',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'minMembers',
    }),
  })
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'minMembers',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'minMembers',
      constraint2: 1,
    }),
  })
  @Type(() => Number)
  minMembers: number;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la categoría (Category)',
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
  categoryId: string;

  @ApiPropertyOptional({
    example: 2015,
    description:
      'Año mínimo de nacimiento permitido (sobreescribe la edad de la categoría)',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'minBirthYear',
    }),
  })
  @Min(1900, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'minBirthYear',
      constraint2: 1900,
    }),
  })
  @IsOptional()
  minBirthYear?: number;

  @ApiPropertyOptional({
    example: 2016,
    description:
      'Año máximo de nacimiento permitido (sobreescribe la edad de la categoría)',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'maxBirthYear',
    }),
  })
  @IsAfter('minBirthYear', {
    message: i18nValidationMessage('validation.IS_AFTER', {
      constraint1: 'minBirthYear',
    }),
  })
  @IsOptional()
  maxBirthYear?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si se validará la edad del estudiante',
    default: true,
  })
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'validateAge',
    }),
  })
  @IsOptional()
  validateAge?: boolean = true;

  @ApiProperty({
    example: 'MALE',
    description: 'Género del programa (MALE, FEMALE, MIXED)',
    enum: ProgramGender,
  })
  @IsEnum(ProgramGender, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'gender',
    }),
  })
  gender: ProgramGender;
}
