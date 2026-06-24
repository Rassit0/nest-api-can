import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateMembershipDiscountDto } from './create-membership-discount.dto';

export class UpdateMembershipDiscountDto extends PartialType(
    OmitType(CreateMembershipDiscountDto, ['playerMembershipId']),
) { }
