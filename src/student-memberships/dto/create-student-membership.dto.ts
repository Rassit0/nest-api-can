import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { StudentMembershipStatus } from 'src/generated/prisma/client';

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
}
