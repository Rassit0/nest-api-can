import { PartialType } from '@nestjs/swagger';
import { CreateHomeDisciplineDto } from './create-home-discipline.dto';

export class UpdateHomeDisciplineDto extends PartialType(CreateHomeDisciplineDto) {
}
