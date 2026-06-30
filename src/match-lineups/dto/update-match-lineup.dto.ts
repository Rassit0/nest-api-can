import { PartialType } from '@nestjs/swagger';
import { CreateMatchLineupDto } from './create-match-lineup.dto';

export class UpdateMatchLineupDto extends PartialType(CreateMatchLineupDto) {}
