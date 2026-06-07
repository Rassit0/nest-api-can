import { PartialType } from '@nestjs/mapped-types';
import { CreatePlayerPassDto } from './create-player-pass.dto';

export class UpdatePlayerPassDto extends PartialType(CreatePlayerPassDto) {}
