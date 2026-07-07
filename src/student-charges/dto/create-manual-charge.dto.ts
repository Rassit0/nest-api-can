import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsDateString, IsString } from 'class-validator';

export class CreateManualChargeDto {
  @ApiProperty()
  @IsUUID()
  membershipId: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty()
  @IsDateString()
  dueDate: string;
}
