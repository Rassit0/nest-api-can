import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize } from 'nestjs-form-data';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { ProgramGender } from 'src/generated/prisma/enums';

export class CreateTeamDto {
  @ApiProperty({
    example: 'Equipo A',
    description: 'Nombre del equipo',
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

  @ApiPropertyOptional({
    example: 'T1',
    description: 'Nombre abreviado del equipo',
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'shortName',
    }),
  })
  @IsOptional()
  shortName?: string;

  @ApiProperty({
    example: 'Equipo 1 del club',
    description: 'Descripción del equipo',
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
    type: 'string',
    format: 'binary',
    required: false,
    description: 'Imagen del equipo (JPEG o PNG, máximo 5MB)',
  })
  @IsOptional()
  @IsFile()
  @MaxFileSize(5e6, {
    message: i18nValidationMessage('validation.MAX_FILE_SIZE', {
      constraint1: '5MB',
    }),
  })
  @HasMimeType(['image/jpeg', 'image/png'], {
    message: i18nValidationMessage('validation.WRONG_FILE_TYPE', {
      constraint1: 'JPEG o PNG',
    }),
  })
  imageUrl?: File | null;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del club al que pertenece el equipo',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'disciplineId',
    }),
  })
  @Exists('club', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'clubId',
    }),
  })
  clubId: string;
}
