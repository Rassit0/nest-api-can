import { BadRequestException } from '@nestjs/common';
import { SeasonStatus, StatusCourseSeason } from 'src/generated/prisma/client';

export class StudentCourseSeasonValidator {
  static assertIsActive(
    courseSeason: {
      status: StatusCourseSeason;
      season: { status: SeasonStatus };
    },
    errorMessage: string,
  ): void {
    if (
      courseSeason.season.status === SeasonStatus.CANCELLED ||
      courseSeason.season.status === SeasonStatus.FINISHED ||
      courseSeason.status === StatusCourseSeason.CANCELLED ||
      courseSeason.status === StatusCourseSeason.FINISHED
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
