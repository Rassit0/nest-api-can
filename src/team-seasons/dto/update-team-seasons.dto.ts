import { PartialType } from '@nestjs/mapped-types';
import { CreateTeamSeasonsDto } from './create-team-seasons.dto';

export class UpdateTeamSeasonDto extends PartialType(CreateTeamSeasonsDto) {}
