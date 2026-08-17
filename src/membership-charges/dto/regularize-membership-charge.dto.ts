import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class RegularizeMembershipChargeDto {
    @IsString()
    @IsNotEmpty()
    cycleId: string;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    overrideAmount?: number;
}
