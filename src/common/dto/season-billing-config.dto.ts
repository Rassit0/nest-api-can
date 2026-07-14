import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { SeasonBillingType, BillingFrequency } from 'src/generated/prisma/enums';

export class SeasonBillingConfigDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Indica si el motor de generación de cargos está activo para esta temporada',
    default: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'isEngineActive',
    }),
  })
  @IsOptional()
  isEngineActive?: boolean;

  @ApiProperty({
    example: 20,
    description: 'Día del mes en que se realiza el cobro de la membresía',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'billingDay',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '1',
    }),
  })
  @Max(28, {
    message: i18nValidationMessage('validation.MAX', {
      constraint1: '28',
    }),
  })
  billingDay: number;

  @ApiPropertyOptional({
    example: '20.00',
    description: 'Costo de matrícula',
  })
  @IsDecimal(
    { decimal_digits: '0,2', locale: 'en-US' },
    {
      message: i18nValidationMessage('validation.IS_DECIMAL', {
        constraint1: 'registrationFee',
      }),
    },
  )
  @Matches(/^[^-].*$/, { message: 'No se permiten valores negativos' })
  @IsOptional()
  registrationFee?: string;

  @ApiPropertyOptional({
    example: '20.00',
    description: 'Costo de la mensualidad',
  })
  @IsDecimal(
    { decimal_digits: '0,2', locale: 'en-US' },
    {
      message: i18nValidationMessage('validation.IS_DECIMAL', {
        constraint1: 'recurringFee',
      }),
    },
  )
  @Matches(/^[^-].*$/, { message: 'No se permiten valores negativos' })
  @IsOptional()
  recurringFee?: string;

  @ApiPropertyOptional({
    example: '150.00',
    description: 'Costo total de la temporada (usado en planes de pago único)',
  })
  @IsDecimal(
    { decimal_digits: '0,2', locale: 'en-US' },
    {
      message: i18nValidationMessage('validation.IS_DECIMAL', {
        constraint1: 'seasonFee',
      }),
    },
  )
  @Matches(/^[^-].*$/, { message: 'No se permiten valores negativos' })
  @IsOptional()
  seasonFee?: string;

  @ApiProperty({
    example: 2,
    description: 'Cantidad de meses de tolerancia de deuda',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'debtToleranceMonths',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '0',
    }),
  })
  @Max(12, {
    message: i18nValidationMessage('validation.MAX', {
      constraint1: '12',
    }),
  })
  debtToleranceMonths: number;

  @ApiProperty({
    example: false,
    description: 'Indica si tiene habilitada una cuota por pago tardío',
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'lateFeeEnabled',
    }),
  })
  lateFeeEnabled: boolean;

  @ApiPropertyOptional({
    example: '1.00',
    description: 'Monto de la cuota por pago tardío',
  })
  @IsDecimal(
    { decimal_digits: '0,2', locale: 'en-US' },
    {
      message: i18nValidationMessage('validation.IS_DECIMAL', {
        constraint1: 'lateFeePerDay',
      }),
    },
  )
  @Matches(/^[^-].*$/, { message: 'No se permiten valores negativos' })
  @IsOptional()
  lateFeePerDay?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Número de días de gracia',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'graceDays',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '0',
    }),
  })
  @IsOptional()
  graceDays?: number;

  @ApiPropertyOptional({
    example: SeasonBillingType.MONTHLY_ONLY,
    enum: SeasonBillingType,
    description: 'Estrategia de facturación',
    default: SeasonBillingType.MONTHLY_ONLY,
  })
  @IsEnum(SeasonBillingType, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'billingType',
    }),
  })
  @IsOptional()
  billingType?: SeasonBillingType;

  @ApiPropertyOptional({
    example: BillingFrequency.MONTHLY,
    enum: BillingFrequency,
    description: 'Frecuencia de facturación',
    default: BillingFrequency.MONTHLY,
  })
  @IsEnum(BillingFrequency, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'billingFrequency',
    }),
  })
  @IsOptional()
  billingFrequency?: BillingFrequency;

  @ApiPropertyOptional({
    example: true,
    description: 'Prorratear la primera cuota recurrente',
    default: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'prorateFirstRecurringFee',
    }),
  })
  @IsOptional()
  prorateFirstRecurringFee?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Prorratear la última cuota recurrente',
    default: true,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'prorateLastRecurringFee',
    }),
  })
  @IsOptional()
  prorateLastRecurringFee?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Prorratear el monto de inscripción',
    default: false,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'prorateRegistrationFee',
    }),
  })
  @IsOptional()
  prorateRegistrationFee?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Prorratear el monto de temporada completa',
    default: false,
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'prorateSeasonFee',
    }),
  })
  @IsOptional()
  prorateSeasonFee?: boolean;

  @ApiPropertyOptional({
    example: 7,
    description: 'Días antes de generar el cargo',
    default: 7,
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'chargeGenerationDaysBefore',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '1',
    }),
  })
  @IsOptional()
  chargeGenerationDaysBefore?: number;
}
