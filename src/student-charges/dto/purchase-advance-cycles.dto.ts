import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsISO8601, IsOptional, ValidateNested } from 'class-validator';

export class CycleEnrollmentInputDto {
  @ApiProperty({
    description: 'Fecha de inicio del ciclo (UTC 00:00:00).',
    example: '2026-09-01T00:00:00.000Z',
  })
  @IsISO8601()
  cycleStartDate: string;

  @ApiPropertyOptional({
    description: 'Fecha efectiva de inscripción al ciclo. Si no se envía, se toma la fecha de inicio del ciclo o la actual.',
    example: '2026-09-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  enrollmentDate?: string;
}

export class PurchaseAdvanceCyclesDto {
  @ApiProperty({
    description: 'Ciclos que se desean adelantar, con su respectiva fecha de inscripción opcional.',
    type: [CycleEnrollmentInputDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CycleEnrollmentInputDto)
  cycles: CycleEnrollmentInputDto[];
}
