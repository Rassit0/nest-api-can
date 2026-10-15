import { IsUUID, IsOptional, IsISO8601 } from 'class-validator';

export class CourseCycleEnrollmentQueryDto {
  @IsUUID()
  disciplineId: string;

  @IsUUID()
  schoolId: string;

  @IsOptional()
  @IsUUID()
  courseSeasonId?: string;

  @IsUUID()
  courseSeasonShiftId: string;

  @IsISO8601()
  cycleStartDate: string;

  @IsISO8601()
  cycleEndDate: string;

  @IsOptional()
  @IsISO8601()
  issuedAt?: string;

  @IsOptional()
  @IsISO8601()
  emissionDate?: string;
}
