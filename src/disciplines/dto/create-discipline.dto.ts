import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDisciplineDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  icon: string;
}
