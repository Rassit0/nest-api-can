import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsUUID, IsNotEmpty } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class MatchTeamContextDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la categoría de la temporada del equipo',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'teamSeasonCategoryId',
    }),
  })
  teamSeasonCategoryId: string;

  @ApiProperty({
    example: '2026-06-30T15:00:00.000Z',
    description: 'Fecha del partido (ISO 8601)',
  })
  @IsNotEmpty()
  @IsISO8601({ strict: true }, {
    message: i18nValidationMessage('validation.IS_DATE', {
      constraint1: 'matchDate',
    }),
  })
  matchDate: string;
}
