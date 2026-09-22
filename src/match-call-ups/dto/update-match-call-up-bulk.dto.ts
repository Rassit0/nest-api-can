import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { MatchSide } from 'src/generated/prisma/client';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class MatchCallUpPlayerDto {
  @IsUUID('4')
  @Exists('player', 'id', { message: 'El jugador no existe' })
  playerId: string;

  @IsOptional()
  @IsBoolean()
  isGuest?: boolean = false;
}

export class UpdateMatchCallUpBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchCallUpPlayerDto)
  players: MatchCallUpPlayerDto[];
}
