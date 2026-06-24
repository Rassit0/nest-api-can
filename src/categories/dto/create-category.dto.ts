import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'U-13',
    description: 'Nombre de la rama/categoría deportiva',
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  @MinLength(3, {
    message: i18nValidationMessage('validation.MIN_LENGTH', {
      constraint1: 'name',
      constraint2: 3,
    }),
  })
  name: string;

  @ApiProperty({
    example: 'Categoría para menores de 13 años',
    description: 'Descripción de la categoría',
    required: false,
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  @MinLength(3, {
    message: i18nValidationMessage('validation.MIN_LENGTH', {
      constraint1: 'name',
      constraint2: 3,
    }),
  })
  @IsOptional()
  description: string;

  @ApiProperty({
    example: 13,
    description: 'Edad máxima permitida',
  })
  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'maxAge',
      }),
    },
  )
  maxAge: number;

  @ApiProperty({
    example: 10,
    description: 'Edad mínima permitida',
  })
  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'minAge',
      }),
    },
  )
  minAge: number;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la disciplina',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'disciplineId',
    }),
  })
  @Exists('discipline', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'disciplineId',
    }),
  })
  disciplineId: string;
}
