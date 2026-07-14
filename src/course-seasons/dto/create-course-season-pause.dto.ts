import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCourseSeasonPauseDto {
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
