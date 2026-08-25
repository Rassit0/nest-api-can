import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, Matches, IsISO8601 } from 'class-validator';

export class CreateGeneralEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, { message: 'Date must include timezone' })
  startDate: string;

  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, { message: 'Date must include timezone' })
  endDate: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  // GeneralEvent specific fields
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  teamSeasonCategoryId?: string;

  @IsOptional()
  @IsUUID()
  courseSeasonId?: string;

  @IsOptional()
  @IsUUID()
  courseSeasonShiftId?: string;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
