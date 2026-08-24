import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTeamSeasonPauseDto {
  @IsISO8601({ strict: true })
  @IsNotEmpty()
  startDate: string;

  @IsISO8601({ strict: true })
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
