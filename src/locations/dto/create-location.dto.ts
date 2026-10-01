import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsNumber, Min, Max, IsUrl } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateLocationDto {
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'name',
    }),
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  name: string;

  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'description',
    }),
  })
  description?: string | null;

  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'address',
    }),
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'address',
    }),
  })
  address: string;

  @IsOptional()
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'isActive',
    }),
  })
  isInternal?: boolean;

  @IsOptional()
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'isRentable',
    }),
  })
  isRentable?: boolean;

  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @IsNumber({}, {
    message: i18nValidationMessage('validation.IS_NUMBER', {
      constraint1: 'latitude',
    }),
  })
  @Min(-90, { message: 'La latitud debe ser mayor o igual a -90' })
  @Max(90, { message: 'La latitud debe ser menor o igual a 90' })
  latitude?: number | null;

  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @IsNumber({}, {
    message: i18nValidationMessage('validation.IS_NUMBER', {
      constraint1: 'longitude',
    }),
  })
  @Min(-180, { message: 'La longitud debe ser mayor o igual a -180' })
  @Max(180, { message: 'La longitud debe ser menor o igual a 180' })
  longitude?: number | null;

  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @IsUrl({}, {
    message: i18nValidationMessage('validation.IS_URL', {
      constraint1: 'googleMapsUrl',
    }),
  })
  googleMapsUrl?: string | null;
}
