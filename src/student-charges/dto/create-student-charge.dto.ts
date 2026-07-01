import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { TypeMembershipCharge } from 'src/generated/prisma/client';

export class CreateStudentChargeDto {
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
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del cargo base (Charge)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'chargeId',
    }),
  })
  @Exists('charge', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'chargeId',
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'chargeId',
    }),
  })
  chargeId: string;

  @ApiProperty({
    enum: TypeMembershipCharge,
    example: TypeMembershipCharge.MONTHLY_FEE,
    description: 'Tipo de cargo (REGISTRATION, MONTHLY_FEE, LATE_FEE)',
  })
  @IsEnum(TypeMembershipCharge, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'type',
    }),
  })
  type: TypeMembershipCharge;

  @ApiPropertyOptional({
    example: 2026,
    description: 'Año de facturación comercial',
    nullable: true,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'billingYear',
    }),
  })
  @Type(() => Number)
  billingYear?: number | null;

  @ApiPropertyOptional({
    example: 6,
    description: 'Mes de facturación comercial (1 a 12)',
    nullable: true,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'billingMonth',
    }),
  })
  @Type(() => Number)
  billingMonth?: number | null;
}
