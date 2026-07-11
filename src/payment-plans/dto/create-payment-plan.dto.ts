import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDecimal,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { IsAfter } from 'src/common/validators/decorators/is-after.decorator';

export class CreatePaymentPlanDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'ID de la oferta de membresía a la que pertenece este plan de pago',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'teamSeasonId',
    }),
  })
  @Exists('teamSeason', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'teamSeasonId',
    }),
  })
  @IsOptional()
  teamSeasonId?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'ID de la temporada del curso a la que pertenece este plan de pago',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'courseSeasonId',
    }),
  })
  @Exists('courseSeason', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'courseSeasonId',
    }),
  })
  @IsOptional()
  courseSeasonId?: string;

  @ApiProperty({
    example:
      'Plan de pago con descuento del 20% a la mensualidad y matrícula para la oferta de membresía X',
    description: 'Nombre del plan de pago',
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
    example: '20.00',
    description:
      'Porcentaje de descuento de matrícula aplicado a este plan de pago',
  })
  @IsOptional()
  @IsDecimal(
    {
      decimal_digits: '0,2',
      locale: 'en-US',
    },
    {
      message: i18nValidationMessage('validation.IS_STRING', {
        constraint1: 'registrationDiscountPercent',
      }),
    },
  )
  @Matches(/^[^-].*$/, {
    message: 'No se permiten valores negativos',
  })
  @Matches(/^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)$/, {
    message: 'El porcentaje debe estar entre 0 y 100',
  })
  registrationDiscountPercent?: string;

  @ApiPropertyOptional({
    example: '20.00',
    description: 'Porcentaje de descuento para la tarifa mensual. Si el plan es de pago mensual, descuenta a la mensualidad.',
  })
  @IsOptional()
  @IsDecimal(
    {
      decimal_digits: '0,2',
      locale: 'en-US',
    },
    {
      message: i18nValidationMessage('validation.IS_STRING', {
        constraint1: 'recurringDiscountPercent',
      }),
    },
  )
  @Matches(/^[^-].*$/, {
    message: 'No se permiten valores negativos',
  })
  @Matches(/^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)$/, {
    message: 'El porcentaje debe estar entre 0 y 100',
  })
  recurringDiscountPercent?: string;

  @ApiPropertyOptional({
    example: '15.00',
    description: 'Porcentaje de descuento aplicado a la tarifa de la temporada completa cuando es un plan de pago único.',
  })
  @IsOptional()
  @IsDecimal(
    {
      decimal_digits: '0,2',
      locale: 'en-US',
    },
    {
      message: i18nValidationMessage('validation.IS_STRING', {
        constraint1: 'seasonFeeDiscountPercent',
      }),
    },
  )
  @Matches(/^[^-].*$/, {
    message: 'No se permiten valores negativos',
  })
  @Matches(/^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)$/, {
    message: 'El porcentaje debe estar entre 0 y 100',
  })
  seasonFeeDiscountPercent?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Si es true, este plan agrupa toda la temporada en un solo cobro adelantado',
    default: false,
  })
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'isSinglePayment',
    }),
  })
  @IsOptional()
  isSinglePayment?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Si es true, este plan serA! seleccionado por defecto en el formulario',
    default: false,
  })
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'isDefault',
    }),
  })
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({
    example: 1,
    description: 'Cantidad de cuotas agrupadas/adelantadas',
    default: 1,
  })
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT'),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN'),
  })
  @IsOptional()
  advanceCycles?: number;

  @ApiPropertyOptional({
    example: '15.00',
    description: 'Porcentaje de descuento aplicado a las cuotas agrupadas/adelantadas',
  })
  @IsOptional()
  @IsDecimal(
    {
      decimal_digits: '0,2',
      locale: 'en-US',
    },
    {
      message: i18nValidationMessage('validation.IS_STRING', {
        constraint1: 'advanceCyclesDiscountPercent',
      }),
    },
  )
  @Matches(/^[^-].*$/, {
    message: 'No se permiten valores negativos',
  })
  @Matches(/^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)$/, {
    message: 'El porcentaje debe estar entre 0 y 100',
  })
  advanceCyclesDiscountPercent?: string;

}
