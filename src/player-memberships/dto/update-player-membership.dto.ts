import { PartialType } from '@nestjs/swagger';
import { CreatePlayerMembershipDto } from './create-player-membership.dto';

export class UpdatePlayerMembershipDto extends PartialType(
  CreatePlayerMembershipDto,
) {}
