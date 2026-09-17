import { PartialType } from '@nestjs/swagger';
import { CreateHeroBannerDto } from './create-hero-banner.dto';
import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateHeroBannerDto extends PartialType(CreateHeroBannerDto) {
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  removeImage1x1?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  removeImage3x4?: boolean;
}
