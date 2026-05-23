import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  IsISO8601,
  IsDecimal,
  ValidateIf,
  IsArray,
  Validate,
  IsUUID,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { IsAfter } from '../validators/decorators/is-after.decorator';

export class CreateActivityDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  )
  startsAt: string;

  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  )
  // Validacion para que la fecha final sea mayor a la inicial
  @IsAfter('startDateTime', {
    message: i18nValidationMessage('validation.IS_AFTER_START_DATE'),
  })
  endsAt: string;

  @IsUUID()
  @Exists('location', 'id', {
    message: i18nValidationMessage('validation.EXISTS', {
      constraint1: 'locationId',
    }),
  })
  locationId: string;
}
