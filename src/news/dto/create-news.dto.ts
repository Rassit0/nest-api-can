import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { NewsStatus } from 'src/generated/prisma/enums';

export class CreateNewsDto {
  @IsString()
  title: string;

  @IsString()
  excerpt: string;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  authorName?: string;

  @IsEnum(NewsStatus)
  @IsOptional()
  status?: NewsStatus;

  @IsDateString()
  @IsOptional()
  publishedAt?: string;
}
