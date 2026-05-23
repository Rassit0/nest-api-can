import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize } from 'nestjs-form-data';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateOrganizationDto {
  @IsString({ message: i18nValidationMessage('validation.IsString') })
  name: string;

  @IsOptional()
  // 1. Transformamos los valores problemáticos a null real
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // 2. Si el valor es null, saltamos la validación de Enum para que no falle
  @ValidateIf((object, value) => value !== null)
  @IsFile()
  @MaxFileSize(5e6)
  @HasMimeType(['image/jpeg', 'image/png'])
  imageUrl?: string;

  // @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  @IsString({
    message: i18nValidationMessage('validation.IsString', {
      constraint1: 'address',
    }),
  })
  @IsDefined()
  // @IsOptional()
  address: string;

  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  @IsString({
    message: i18nValidationMessage('validation.IsString', {
      constraint1: 'phone',
    }),
  })
  @IsOptional()
  phone?: string | null;

  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  @IsEmail(
    {},
    {
      message: i18nValidationMessage('validation.IS_EMAIL', {
        constraint1: 'email',
      }),
    },
  )
  @IsOptional()
  email?: string | null;

  // @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  // @IsString({
  //   message: i18nValidationMessage('validation.IsString', {
  //     constraint1: 'description',
  //   }),
  // })
  // @IsOptional()
  // description?: string | null;
}
