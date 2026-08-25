import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTeamSeasonDto } from './create-team-season.dto';

export class UpdateTeamSeasonDto extends PartialType(
  OmitType(CreateTeamSeasonDto, ['categories', 'teamId', 'seasonId'] as const)
) {}
