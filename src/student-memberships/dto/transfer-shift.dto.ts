import { IsUUID, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferShiftDto {
  @ApiProperty({
    description: 'ID de la temporada/turno destino (CourseSeason)',
    example: 'uuid-del-course-season-destino',
  })
  @IsUUID()
  @IsNotEmpty()
  targetCourseSeasonId: string;

  @ApiProperty({
    description: 'Fecha en la que se solicita la transferencia',
    example: '2026-08-20T00:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  effectiveDate: Date;
}
