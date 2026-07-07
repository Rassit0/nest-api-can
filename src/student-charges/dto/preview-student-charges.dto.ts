import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsDateString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class PreviewStudentChargesDto {
  @ApiProperty()
  @IsUUID()
  courseSeasonId: string;

  @ApiProperty()
  @IsUUID()
  paymentPlanId: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  studentDiscounts?: any[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isMigrated?: boolean;
}
