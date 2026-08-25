import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { IsAfter } from 'src/common/validators/decorators/is-after.decorator';
import { ProgramGender } from 'src/generated/prisma/enums';

export class CreateTeamSeasonCategoryDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la categoría',
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

  @ApiProperty({
    example: 'MALE',
    enum: ProgramGender,
    description: 'Género del programa para esta categoría',
  })
  @IsEnum(ProgramGender, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'gender',
    }),
  })
  gender: ProgramGender;

  @ApiProperty({
    example: 20,
    description: 'Número máximo de miembros permitidos en esta categoría',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'maxMembers',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '1',
    }),
  })
  @IsAfter('minMembers', {
    message: i18nValidationMessage('validation.IS_AFTER', {
      constraint1: 'minMembers',
    }),
  })
  maxMembers: number;

  @ApiProperty({
    example: 10,
    description: 'Número mínimo de miembros permitidos en esta categoría',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'minMembers',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '1',
    }),
  })
  minMembers: number;

  @ApiPropertyOptional({
    example: 2015,
    description: 'Año mínimo de nacimiento permitido (sobreescribe la edad de la categoría)',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'minBirthYear',
    }),
  })
  @Min(1900, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '1900',
    }),
  })
  @IsOptional()
  minBirthYear?: number;

  @ApiPropertyOptional({
    example: 2016,
    description: 'Año máximo de nacimiento permitido (sobreescribe la edad de la categoría)',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'maxBirthYear',
    }),
  })
  @Min(1900, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '1900',
    }),
  })
  @IsOptional()
  maxBirthYear?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si se debe validar la edad al inscribir basándose en minBirthYear/maxBirthYear o en la categoría',
    default: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  validateAge?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si la categoría está activa',
    default: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
