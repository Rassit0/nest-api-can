import {
  IsArray,
  IsBoolean,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class MatchLineupEntryDto {
  @ApiProperty({ description: 'ID de la convocatoria (MatchCallUp)' })
  @IsUUID('4')
  callUpId: string;

  @ApiProperty({ description: 'Indica si el jugador inició como titular' })
  @IsBoolean()
  isStarter: boolean;

  @ApiProperty({ description: 'Minutos jugados (mayor o igual a 0)' })
  @IsInt()
  @Min(0)
  minutesPlayed: number;

  @ApiProperty({ description: 'Goles anotados' })
  @IsInt()
  @Min(0)
  goals: number;

  @ApiProperty({ description: 'Asistencias realizadas' })
  @IsInt()
  @Min(0)
  assists: number;

  @ApiProperty({ description: 'Tarjetas amarillas recibidas' })
  @IsInt()
  @Min(0)
  yellowCards: number;

  @ApiProperty({ description: 'Tarjetas rojas recibidas' })
  @IsInt()
  @Min(0)
  redCards: number;
}

export class UpdateMatchLineupBulkDto {
  @ApiProperty({
    type: [MatchLineupEntryDto],
    description: 'Lista de jugadores que registraron participación',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchLineupEntryDto)
  lineups: MatchLineupEntryDto[];
}
