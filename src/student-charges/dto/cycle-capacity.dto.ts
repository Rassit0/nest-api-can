import { ApiProperty } from '@nestjs/swagger';

export class CycleCapacityDto {
  @ApiProperty({ description: 'Fecha de inicio del ciclo', type: Date })
  cycleStartDate: Date;

  @ApiProperty({ description: 'Fecha de fin del ciclo', type: Date })
  cycleEndDate: Date;

  @ApiProperty({ description: 'ID del turno' })
  shiftId: string;

  @ApiProperty({ description: 'Nombre del turno' })
  shiftName: string;

  @ApiProperty({
    description: 'Capacidad máxima (null si es ilimitada)',
    type: Number,
    nullable: true,
  })
  maxMembers: number | null;

  @ApiProperty({ description: 'Cantidad de lugares ocupados válidos' })
  occupiedSpots: number;

  @ApiProperty({
    description: 'Cantidad de lugares disponibles (null si es ilimitada)',
    type: Number,
    nullable: true,
  })
  availableSpots: number | null;

  @ApiProperty({
    description: 'Estado de la capacidad (AVAILABLE o FULL)',
    enum: ['AVAILABLE', 'FULL'],
  })
  status: 'AVAILABLE' | 'FULL';
}
