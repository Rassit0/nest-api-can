import { PartialType } from '@nestjs/swagger';
import { CreateMembershipChargeDto } from './create-membership-charge.dto';

export class UpdateMembershipChargeDto extends PartialType(
  CreateMembershipChargeDto,
) {}
