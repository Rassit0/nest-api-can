import { IsDateString, IsEnum, IsOptional, IsString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { EventType } from 'src/generated/prisma/client';

export class CalendarFilterDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsArray()
  @IsEnum(EventType, { each: true })
  @Type(() => String)
  eventTypes?: EventType[];

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  institutionId?: string;
  
  @IsOptional()
  @IsString()
  teamSeasonCategoryId?: string;
  
  @IsOptional()
  @IsString()
  courseSeasonId?: string;
}
