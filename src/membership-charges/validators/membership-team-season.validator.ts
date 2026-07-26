import { BadRequestException } from '@nestjs/common';
import { SeasonStatus, StatusTeamSeason } from 'src/generated/prisma/client';

export class MembershipTeamSeasonValidator {
  static assertIsActive(
    teamSeason: { status: StatusTeamSeason; season: { status: SeasonStatus } },
    errorMessage: string,
  ): void {
    if (
      teamSeason.season.status === SeasonStatus.CANCELLED ||
      teamSeason.season.status === SeasonStatus.FINISHED ||
      teamSeason.status === StatusTeamSeason.CANCELLED ||
      teamSeason.status === StatusTeamSeason.FINISHED
    ) {
      throw new BadRequestException(errorMessage);
    }
  }

  static assertDateWithinSeason(
    mockStartedAt: Date,
    seasonStart: Date,
    seasonEndValidation: Date,
  ): void {
    if (mockStartedAt < seasonStart || mockStartedAt > seasonEndValidation) {
      throw new BadRequestException(
        'La fecha de inicio debe estar dentro de la duración de la temporada',
      );
    }
  }
}
