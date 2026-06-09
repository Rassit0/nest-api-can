import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsDate,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDefined,
  IsISO8601,
  ValidateIf,
  IsBoolean,
} from 'class-validator';
import {
  HasMimeType,
  IsFile,
  MaxFileSize,
  MemoryStoredFile,
} from 'nestjs-form-data';
import { i18nValidationMessage } from 'nestjs-i18n';
import { DocumentType, Gender } from 'src/generated/prisma/enums';

export class CreatePersonDto {
  @IsString({
    message: 'El nombre debe ser una cadena de texto',
  })
  @IsDefined({ message: 'El nombre es requerido' })
  name: string;

  @IsString({
    message: 'El apellido debe ser una cadena de texto',
  })
  @IsDefined({ message: 'El apellido es requerido' })
  lastName: string;

  @IsOptional()
  // 1. Transformamos los valores problemáticos a null real
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  @ValidateIf((object, value) => value !== null)
  @IsString({
    message: 'El segundo apellido debe ser una cadena de texto',
  })
  secondLastName?: string | null;

  @IsOptional()
  // 1. Transformamos los valores problemáticos a null real
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  @ValidateIf((object, value) => value !== null)
  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  )
  birthDate?: string;

  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsFile()
  @MaxFileSize(5e6)
  @HasMimeType(['image/jpeg', 'image/png'])
  imageUrl?: MemoryStoredFile;

  @IsEnum(DocumentType, {
    message: 'Tipo de documento inválido, los tipos son: CI, PASAPORTE',
  })
  documentType: DocumentType;

  @IsString({
    message: 'El número de documento debe ser una cadena de texto',
  })
  @IsDefined({ message: 'El número de documento es requerido' })
  documentNumber: string;

  @IsOptional()
  // 1. Transformamos los valores problemáticos a null real
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  @ValidateIf((object, value) => value !== null)
  @IsString({
    message: 'El teléfono debe ser una cadena de texto',
  })
  phone?: string | null;

  @IsOptional()
  // 1. Transformamos los valores problemáticos a null real
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  @ValidateIf((object, value) => value !== null)
  @IsEmail(
    {},
    {
      message: i18nValidationMessage('validation.IS_EMAIL', {
        constraint1: 'email',
      }),
    },
  )
  email?: string | null;

  @IsOptional()
  // 1. Transformamos los valores problemáticos a null real
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  @ValidateIf((object, value) => value !== null)
  @IsString({
    message: 'La dirección debe ser una cadena de texto',
  })
  address?: string | null;

  @IsEnum(Gender, {
    message: 'Genero inválido, los generos son: MALE, FEMALE',
  })
  gender: Gender;

  // @IsOptional()
  // // 1. Transformamos los valores problemáticos a null real
  // @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  // @ValidateIf((object, value) => value !== null)
  // @IsEnum(UniformSize, {
  //   message:
  //     'Talla de uniforme inválida, las tallas son: XS, S, M, L, XL, XXL, XXXL',
  // })
  // standardSize?: UniformSize | null;
  // @IsArray({ message: 'Los IDs de los tutores deben ser un arreglo' })
  // @IsInt({ each: true, message: 'Cada ID de tutor debe ser un número entero' })
  // @IsOptional()
  // tutorIds?: number[]; // Cambiado de number a number[]
}
