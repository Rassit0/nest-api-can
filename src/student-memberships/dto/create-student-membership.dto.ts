import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { StudentMembershipStatus, MembershipDiscountType } from 'src/generated/prisma/client';
import { ValidateNested, IsNumber, IsDateString, IsArray } from 'class-validator';

export class StudentDiscountDto {
  @ApiProperty({ description: 'Porcentaje de descuento en la matrícula', example: 10 })
  @IsNumber()
  registrationDiscountPercent: number;

  @ApiProperty({ description: 'Porcentaje de descuento en la mensualidad', example: 15 })
  @IsNumber()
  recurringDiscountPercent: number;

  @ApiPropertyOptional({ description: 'Porcentaje de descuento en el pago de temporada', example: 0 })
  @IsOptional()
  @IsNumber()
  seasonFeeDiscountPercent?: number;

  @ApiProperty({ description: 'Fecha de inicio del descuento', example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'Fecha de fin del descuento', example: '2024-12-31', nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiProperty({ description: 'Tipo de descuento', enum: MembershipDiscountType })
  @IsEnum(MembershipDiscountType)
  type: MembershipDiscountType;

  @ApiPropertyOptional({ description: 'Razón del descuento', example: 'Descuento especial', nullable: true })
  @IsOptional()
  @IsString()
  reason?: string | null;
}

export class CreateStudentMembershipDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del estudiante (Student)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'studentId',
    }),
  })
  @Exists('student', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'studentId',
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'studentId',
    }),
  })
  studentId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la temporada del curso (CourseSeason)',
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
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'courseSeasonId',
    }),
  })
  courseSeasonId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del plan de pago (PaymentPlan)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'paymentPlanId',
    }),
  })
  @Exists('paymentPlan', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'paymentPlanId',
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'paymentPlanId',
    }),
  })
  paymentPlanId: string;

  @ApiProperty({
    example: '2026-06-30T00:00:00.000Z',
    description: 'Fecha de inicio de la membresía',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'startedAt',
    }),
  })
  @IsDate({
    message: i18nValidationMessage('validation.IS_DATE', {
      constraint1: 'startedAt',
    }),
  })
  @Type(() => Date)
  startedAt: Date;

  @ApiPropertyOptional({
    example: '2026-12-31T00:00:00.000Z',
    description: 'Fecha de fin de la membresía',
    nullable: true,
  })
  @IsOptional()
  @IsDate({
    message: i18nValidationMessage('validation.IS_DATE', {
      constraint1: 'endedAt',
    }),
  })
  @Type(() => Date)
  endedAt?: Date | null;

  @ApiPropertyOptional({
    enum: StudentMembershipStatus,
    example: StudentMembershipStatus.PENDING,
    description:
      'Estado de la inscripción (PENDING, ACTIVE, SUSPENDED, WITHDRAWN, FINISHED)',
    default: StudentMembershipStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(StudentMembershipStatus, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'status',
    }),
  })
  status?: StudentMembershipStatus = StudentMembershipStatus.PENDING;

  @ApiPropertyOptional({
    example: 'Inscripción bajo convenio con descuento escolar',
    description: 'Notas u observaciones de la inscripción',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'notes',
    }),
  })
  notes?: string | null;

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si la membresía proviene de una migración para evitar cargos anteriores',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isMigrated?: boolean;

  @ApiPropertyOptional({
    description: 'Lista de descuentos excepcionales aplicables a la membresía de escuela',
    type: () => [StudentDiscountDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentDiscountDto)
  studentDiscounts?: StudentDiscountDto[];
}
