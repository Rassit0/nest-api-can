import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTeamSeasonPauseDto {
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
