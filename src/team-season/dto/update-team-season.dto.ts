import { PartialType } from '@nestjs/swagger';
import { CreateTeamSeasonDto } from './create-team-season.dto';

export class UpdateTeamSeasonDto extends PartialType(CreateTeamSeasonDto) {}
