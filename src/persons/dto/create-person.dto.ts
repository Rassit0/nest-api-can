import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsDate,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDefined,
  IsArray,
  IsInt,
  IsISO8601,
  ValidateIf,
} from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize } from 'nestjs-form-data';
import { UniformSize } from 'src/generated/prisma/enums';

export class CreatePersonDto {
  @IsString({
    message: 'La CI debe ser una cadena de texto',
  })
  @IsDefined({ message: 'La CI es requerida' })
  ci: string;

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
    message: 'El apellido debe ser una cadena de texto',
  })
  surName?: string;

  @IsOptional()
  // 1. Transformamos los valores problemáticos a null real
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  @ValidateIf((object, value) => value !== null)
  @IsEmail()
  email?: string;

  @IsOptional()
  // 1. Transformamos los valores problemáticos a null real
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  @ValidateIf((object, value) => value !== null)
  @IsString({
    message: 'El teléfono debe ser una cadena de texto',
  })
  phone?: string;

  @IsOptional()
  // 1. Transformamos los valores problemáticos a null real
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  @ValidateIf((object, value) => value !== null)
  @IsString({
    message: 'El teléfono de emergencia debe ser una cadena de texto',
  })
  phoneEmergency?: string;

  @IsOptional()
  // 1. Transformamos los valores problemáticos a null real
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  @ValidateIf((object, value) => value !== null)
  @IsString({
    message: 'La dirección debe ser una cadena de texto',
  })
  address?: string;

  @IsOptional()
  // 1. Transformamos los valores problemáticos a null real
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  @ValidateIf((object, value) => value !== null)
  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  ) // 1. Valida el formato string
  // @Type(() => Date) // 2. Si es válido, lo convierte a objeto Date
  // @IsDate() // 3. Verifica que la conversión resultó en una fecha real
  birthDate?: Date;

  @IsOptional()
  // 1. Transformamos los valores problemáticos a null real
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  @ValidateIf((object, value) => value !== null)
  @IsEnum(UniformSize, {
    message:
      'Talla de uniforme inválida, las tallas son: XS, S, M, L, XL, XXL, XXXL',
  })
  standardSize?: UniformSize | null;

  @IsOptional()
  // 1. Transformamos los valores problemáticos a null real
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  @ValidateIf((object, value) => value !== null)
  @IsFile()
  @MaxFileSize(5e6)
  @HasMimeType(['image/jpeg', 'image/png'])
  image?: string;

  // @IsArray({ message: 'Los IDs de los tutores deben ser un arreglo' })
  // @IsInt({ each: true, message: 'Cada ID de tutor debe ser un número entero' })
  // @IsOptional()
  // tutorIds?: number[]; // Cambiado de number a number[]
}
