import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EventType } from 'src/generated/prisma/client';

export class EventFilterDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  teamSeasonId?: string;

  @IsOptional()
  @IsUUID()
  teamSeasonCategoryId?: string;

  @IsOptional()
  @IsUUID()
  courseSeasonId?: string;
}
