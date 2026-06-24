// modules/disciplines/dto/discipline-pagination.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { MembershipDiscountType, PlayerMembershipStatus } from '../../generated/prisma/enums';

export class PlayerMembershipDiscountsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'createdAt',
    enum: ['startedAt', 'endedAt','createdAt', 'id'],
  })
  @IsOptional()
  @IsIn(['startedAt', 'endedAt','createdAt', 'id'], {
    message: i18nValidationMessage('validation.IS_IN', {
      validValues: 'createdAt, id',
    }),
  })
  sortField?: string = 'createdAt';

  @ApiPropertyOptional({
    // example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar por membresia del jugador',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
    })
  })
  @Exists('playerMembership', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'playerMembershipId',
    }),
  })
  @IsOptional()
  playerMembershipId: string;

  @ApiPropertyOptional({
    // example: 'name',
    enum: MembershipDiscountType,
    description: 'Filtrar por tipo de descuento de membresía del jugador (SCHOLARSHIP, SPECIAL_DISCOUNT, FINANCIAL_AID, AGREEMENT, EXEMPTION, OTHER)',
  })
  @IsEnum(MembershipDiscountType, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'MembershipDiscountType',
    }),
  })
  @IsOptional()
  type?: MembershipDiscountType;
}
