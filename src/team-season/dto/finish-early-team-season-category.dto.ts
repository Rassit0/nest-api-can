import { IsOptional, IsString } from 'class-validator';

export class FinishEarlyTeamSeasonCategoryDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
