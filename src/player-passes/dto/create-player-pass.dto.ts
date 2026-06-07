import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { IsAfter } from 'src/common/validators/decorators/is-after.decorator';
import {
  PassOriginType,
  PlayerPassStatus,
  PreviousTeamSource,
} from 'src/generated/prisma/enums';
import { IsValidPassOrigin } from '../validators/decorators/is-valid-pass.decorator';

// Valida obligar a enviar previousTeamId o externalPreviousTeamName dependiendo del originType
@IsValidPassOrigin()
export class CreatePlayerPassDto {
  @IsUUID()
  @Exists('player', 'id', {
    message: i18nValidationMessage('validation.EXISTS', {
      constraint1: 'playerId',
    }),
  })
  playerId: string;

  @IsUUID()
  @Exists('team', 'id', {
    message: i18nValidationMessage('validation.EXISTS', {
      constraint1: 'previousTeamId',
    }),
  })
  @IsOptional()
  previousTeamId?: string;

  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @IsOptional()
  externalPreviousTeamName?: string;

  @IsUUID()
  @Exists('team', 'id', {
    message: i18nValidationMessage('validation.EXISTS', {
      constraint1: 'currentTeamId',
    }),
  })
  currentTeamId: string;

  // Indica si el equipo previo esta dentro o fuera de la Organizacion, o bien si es libre
  @IsEnum(PreviousTeamSource, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'PreviousTeamSource',
    }),
  })
  previousTeamSource: PreviousTeamSource;

  @IsEnum(PassOriginType, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'PassOriginType',
    }),
  })
  originType: PassOriginType;

  @IsEnum(PlayerPassStatus, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'PlayerPassStatus',
    }),
  })
  status: PlayerPassStatus;

  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  )
  startDate: string;

  // Validacion para que la fecha final sea mayor a la inicial
  // @IsAfter('startDate', {
  //   message: i18nValidationMessage('validation.IS_AFTER_START_DATE'),
  // })
  // endDate: string;

  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @IsOptional()
  notes: string;
}
