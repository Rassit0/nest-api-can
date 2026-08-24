import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Min, IsOptional, IsISO8601, Matches } from 'class-validator';

export class ReactivateStudentMembershipDto {
  @ApiProperty({
    description: 'Cantidad de próximos ciclos a comprar para la reactivación',
    example: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Fecha efectiva de reingreso en formato ISO 8601 con timezone explícito',
    example: '2026-09-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, {
    message: 'reentryDate debe incluir información explícita de timezone (ej. terminar en Z o tener offset +00:00)',
  })
  reentryDate?: string;
}
