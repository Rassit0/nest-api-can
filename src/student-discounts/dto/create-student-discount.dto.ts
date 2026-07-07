import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { MembershipDiscountType } from 'src/generated/prisma/client';

export class CreateStudentDiscountDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la membresía escolar asociada (StudentMembership)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'studentMembershipId',
    }),
  })
  @Exists('studentMembership', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'studentMembershipId',
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'studentMembershipId',
    }),
  })
  studentMembershipId: string;

  @ApiProperty({
    example: 15.0,
    description: 'Porcentaje de descuento en las mensualidades (0.00 a 100.00)',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'recurringDiscountPercent',
    }),
  })
  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'recurringDiscountPercent',
      }),
    },
  )
  @Min(0, {
    message: 'El descuento de mensualidad mínimo es 0%',
  })
  @Max(100, {
    message: 'El descuento de mensualidad máximo es 100%',
  })
  @Type(() => Number)
  recurringDiscountPercent: number;

  @ApiProperty({
    example: 50.0,
    description:
      'Porcentaje de descuento en la matrícula/inscripción (0.00 a 100.00)',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'registrationDiscountPercent',
    }),
  })
  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'registrationDiscountPercent',
      }),
    },
  )
  @Min(0, {
    message: 'El descuento de inscripción mínimo es 0%',
  })
  @Max(100, {
    message: 'El descuento de inscripción máximo es 100%',
  })
  @Type(() => Number)
  registrationDiscountPercent: number;

  @ApiProperty({
    example: '2026-06-30T00:00:00.000Z',
    description: 'Fecha de inicio de vigencia del descuento',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'startDate',
    }),
  })
  @IsDate({
    message: i18nValidationMessage('validation.IS_DATE', {
      constraint1: 'startDate',
    }),
  })
  @Type(() => Date)
  startDate: Date;

  @ApiPropertyOptional({
    example: '2026-12-31T00:00:00.000Z',
    description: 'Fecha de fin de vigencia del descuento',
    nullable: true,
  })
  @IsOptional()
  @IsDate({
    message: i18nValidationMessage('validation.IS_DATE', {
      constraint1: 'endDate',
    }),
  })
  @Type(() => Date)
  endDate?: Date | null;

  @ApiProperty({
    enum: MembershipDiscountType,
    example: MembershipDiscountType.SCHOLARSHIP,
    description:
      'Tipo de descuento (SCHOLARSHIP, SPECIAL_DISCOUNT, FINANCIAL_AID, AGREEMENT, EXEMPTION, OTHER)',
  })
  @IsEnum(MembershipDiscountType, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'type',
    }),
  })
  type: MembershipDiscountType;

  @ApiPropertyOptional({
    example: 'Beca de rendimiento deportivo',
    description: 'Razón o motivo del descuento',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'reason',
    }),
  })
  reason?: string | null;
}
