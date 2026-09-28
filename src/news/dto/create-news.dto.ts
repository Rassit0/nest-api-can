import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  IsUUID,
  IsNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { NewsStatus } from 'src/generated/prisma/enums';

export class CreateNewsDto {
  @IsString()
  title: string;

  @IsString()
  excerpt: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

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

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value; // let validator handle failure
      }
    }
    return value;
  })
  structuredContent?: any;

  @IsString()
  @IsOptional()
  uploadSessionId?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? value : parsed;
    }
    return value;
  })
  contentSchemaVersion?: number;
}
