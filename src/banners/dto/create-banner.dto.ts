import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBannerDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  ctaText?: string;

  @IsString()
  @IsOptional()
  redirectTo?: string;

  @IsString()
  image16x9: string;

  @IsString()
  @IsOptional()
  image1x1?: string;

  @IsString()
  @IsOptional()
  image3x4?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;
}
