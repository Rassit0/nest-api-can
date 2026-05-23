import { PartialType } from '@nestjs/mapped-types';
import { CreateMatchDetailDto } from './create-match-detail.dto';

export class UpdateMatchDetailDto extends PartialType(CreateMatchDetailDto) {}
