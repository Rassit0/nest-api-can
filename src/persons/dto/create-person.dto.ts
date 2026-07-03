import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsISO8601,
  MinLength,
} from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize } from 'nestjs-form-data';
import { i18nValidationMessage } from 'nestjs-i18n';
import { DocumentType, Gender } from 'src/generated/prisma/enums';

export class CreatePersonDto {
  @ApiProperty({
    example: 'Juan',
    description: 'Nombre de la persona',
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  @MinLength(3, {
    message: i18nValidationMessage('validation.MIN_LENGTH', {
      constraint1: '3',
    }),
  })
  name: string;

  @ApiProperty({
    example: 'García',
    description: 'Primer apellido de la persona',
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'lastName',
    }),
  })
  @MinLength(3, {
    message: i18nValidationMessage('validation.MIN_LENGTH', {
      constraint1: '3',
    }),
  })
  lastName: string;

  @ApiProperty({
    example: 'López',
    description: 'Segundo apellido de la persona',
    required: false,
    type: String,
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'secondLastName',
    }),
  })
  @MinLength(3, {
    message: i18nValidationMessage('validation.MIN_LENGTH', {
      constraint1: '3',
    }),
  })
  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  secondLastName?: string | null;

  @IsOptional()
  @ApiProperty({
    example: '2018-01-01T00:00:00.000Z',
    description: 'Fecha de nacimiento de la persona (formato ISO 8601)',
    required: false,
  })
  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  )
  birthDate?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: false,
    description: 'Imagen de la persona (JPEG o PNG, máximo 5MB)',
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
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
    example: DocumentType.CI,
    enum: DocumentType,
    description: 'Tipo de documento de la persona',
  })
  @IsEnum(DocumentType, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'documentType',
    }),
  })
  documentType: DocumentType;

  @ApiProperty({
    example: '12345678',
    description: 'Número de documento de la persona',
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'documentNumber',
    }),
  })
  documentNumber: string;

  @IsOptional()
  @ApiProperty({
    example: '12345678',
    description: 'Número de teléfono de la persona',
    required: false,
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'phone',
    }),
  })
  phone?: string;

  @IsOptional()
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Correo electrónico de la persona',
    required: false,
  })
  @IsEmail(
    {},
    {
      message: i18nValidationMessage('validation.IS_EMAIL', {
        constraint1: 'email',
      }),
    },
  )
  email?: string;

  @IsOptional()
  @ApiProperty({
    example: '123 Main St, Ciudad, País',
    description: 'Dirección de la persona',
    required: false,
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'address',
    }),
  })
  address?: string;

  @ApiProperty({
    // example: 'MALE',
    enum: Gender,
    description: 'Género de la persona',
  })
  @IsEnum(Gender, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'gender',
    }),
  })
  gender: Gender;
}
