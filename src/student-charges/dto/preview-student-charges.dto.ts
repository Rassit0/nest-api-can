import { IsString, IsDateString, IsOptional, IsArray, ValidateNested, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PreviewMembershipDiscountDto {
  @ApiProperty({
    description: 'Porcentaje de descuento en la matrícula',
    example: 10,
  })
  @IsNumber()
  registrationDiscountPercent: number;

  @ApiPropertyOptional({
    description: 'Porcentaje de descuento en el pago de temporada',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  seasonFeeDiscountPercent?: number;

  @ApiProperty({
    description: 'Porcentaje de descuento en la mensualidad',
    example: 15,
  })
  @IsNumber()
  recurringDiscountPercent: number;

  @ApiProperty({
    description: 'Fecha de inicio del descuento (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin del descuento (YYYY-MM-DD)',
    example: '2024-12-31',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;
}

export class PreviewStudentChargesDto {
  @ApiProperty({
    description: 'ID de la temporada del equipo (CourseSeason)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  courseSeasonId: string;

  @ApiProperty({
    description: 'ID del plan de pago',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsString()
  paymentPlanId: string;

  @ApiProperty({
    description: 'Fecha de inicio para el cálculo de cargos (YYYY-MM-DD)',
    example: '2024-02-01',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Lista de descuentos aplicables a la membresía',
    type: () => [PreviewMembershipDiscountDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewMembershipDiscountDto)
  studentDiscounts?: PreviewMembershipDiscountDto[];

  @ApiPropertyOptional({
    description: 'Indica si esta membresía proviene de una migración de datos previos, omitiendo cobros iniciales.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isMigrated?: boolean;
}

