import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CreateMassiveManualChargeDto {
  @ApiProperty({
    description: 'El ID de la temporada del equipo (TeamSeason)',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  @IsNotEmpty()
  teamSeasonId: string;

  @ApiProperty({
    description: 'Descripción que justificará el cargo manual masivo',
    example: 'Inscripción a Torneo Relámpago'
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Monto a cobrar por el cargo a cada jugador',
    example: 50.00
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Fecha límite de pago (Due Date) para todos',
    example: '2026-07-20T00:00:00Z'
  })
  @IsDateString()
  @IsNotEmpty()
  dueDate: string;
}
