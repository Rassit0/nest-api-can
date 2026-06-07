import { Injectable } from '@nestjs/common';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PassOriginType, PreviousTeamSource } from 'src/generated/prisma/enums';
import { CreatePlayerPassDto } from 'src/player-passes/dto/create-player-pass.dto';

@ValidatorConstraint({
  name: 'PassOriginConstraint',
  async: false,
})
@Injectable()
export class PassOriginConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreatePlayerPassDto;

    const hasPreviousTeam = !!dto.previousTeamId;
    const hasExternalPreviousTeam = !!dto.externalPreviousTeamName;

    // =========================
    // AGENTE LIBRE
    // =========================
    if (dto.originType === PassOriginType.FREE_AGENT) {
      if (dto.previousTeamSource !== PreviousTeamSource.FREE_AGENT) {
        return false;
      }

      if (hasPreviousTeam) {
        return false;
      }

      if (hasExternalPreviousTeam) {
        return false;
      }

      return true;
    }

    // =========================
    // PASE INTERNO
    // =========================
    if (dto.originType === PassOriginType.INTERNAL) {
      if (dto.previousTeamSource !== PreviousTeamSource.SYSTEM) {
        return false;
      }

      if (!hasPreviousTeam) {
        return false;
      }

      if (hasExternalPreviousTeam) {
        return false;
      }

      return true;
    }

    // =========================
    // PASE EXTERNO
    // =========================
    if (dto.originType === PassOriginType.EXTERNAL) {
      // Equipo anterior registrado en el sistema
      if (dto.previousTeamSource === PreviousTeamSource.SYSTEM) {
        if (!hasPreviousTeam) {
          return false;
        }

        if (hasExternalPreviousTeam) {
          return false;
        }

        return true;
      }

      // Equipo anterior fuera del sistema
      if (dto.previousTeamSource === PreviousTeamSource.EXTERNAL) {
        if (hasPreviousTeam) {
          return false;
        }

        if (!hasExternalPreviousTeam) {
          return false;
        }

        return true;
      }

      return false;
    }

    return false;
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as CreatePlayerPassDto;

    if (dto.originType === PassOriginType.FREE_AGENT) {
      return 'Un agente libre no debe tener un equipo de origen';
    }

    if (dto.originType === PassOriginType.INTERNAL) {
      return 'Debe seleccionar el equipo de origen para un pase interno';
    }

    if (
      dto.originType === PassOriginType.EXTERNAL &&
      dto.previousTeamSource === PreviousTeamSource.SYSTEM
    ) {
      return 'Debe seleccionar el equipo de origen para el pase externo';
    }

    if (
      dto.originType === PassOriginType.EXTERNAL &&
      dto.previousTeamSource === PreviousTeamSource.EXTERNAL
    ) {
      return 'Debe indicar el nombre del equipo de origen';
    }

    return 'La configuración del origen del pase es inválida';
  }
}
