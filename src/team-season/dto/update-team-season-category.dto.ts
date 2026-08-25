import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTeamSeasonCategoryDto } from './create-team-season-category.dto';

export class UpdateTeamSeasonCategoryDto extends PartialType(
  OmitType(CreateTeamSeasonCategoryDto, ['categoryId'] as const)
) {}
