import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateHeroBannerDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  ctaText?: string;

  @IsString()
  @IsOptional()
  redirectTo?: string;

  @IsOptional()
  image16x9?: string; // Validado en Service/Controller porque llega como File

  @IsOptional()
  image1x1?: string;

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
