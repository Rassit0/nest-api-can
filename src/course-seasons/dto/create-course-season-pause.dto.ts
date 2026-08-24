import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateCourseSeasonPauseDto {
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, {
    message: 'startDate debe incluir información explícita de timezone (ej. terminar en Z o tener offset +00:00)',
  })
  @IsNotEmpty()
  startDate: string;

  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, {
    message: 'endDate debe incluir información explícita de timezone (ej. terminar en Z o tener offset +00:00)',
  })
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  courseSeasonShiftId?: string;
}
