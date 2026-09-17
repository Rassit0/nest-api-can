import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateHomeDisciplineDto {
  @IsString()
  title: string;

@IsString()
  @IsOptional()
  redirectTo?: string;

  @IsOptional()
  image4x3?: string; // Validado en Service/Controller porque llega como File

@IsOptional()
  image3x4?: string;

@IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;
}
