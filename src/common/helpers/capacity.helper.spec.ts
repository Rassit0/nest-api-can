import { buildValidOccupancyCondition } from './capacity.helper';
import { CycleEnrollmentStatus } from 'src/generated/prisma/client';

describe('capacity.helper', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('buildValidOccupancyCondition', () => {
    it('Debe incluir CONFIRMED y PENDING recientes (< 24h)', () => {
      const now = new Date('2026-08-24T12:00:00Z');
      jest.setSystemTime(now);

      const condition = buildValidOccupancyCondition();
      
      const graceWindow = new Date(now.getTime() - (24 * 60 * 60 * 1000));

      expect(condition).toEqual({
        OR: [
          { status: CycleEnrollmentStatus.CONFIRMED },
          {
            status: CycleEnrollmentStatus.PENDING,
            createdAt: { gt: graceWindow },
          },
        ],
      });
    });
  });
});
