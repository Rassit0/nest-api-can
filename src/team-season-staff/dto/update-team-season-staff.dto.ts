import { PartialType } from '@nestjs/swagger';
import { CreateTeamSeasonStaffDto } from './create-team-season-staff.dto';

export class UpdateTeamSeasonStaffDto extends PartialType(
  CreateTeamSeasonStaffDto,
) {}
