import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from 'src/prisma.service';
import { AvailabilityEngine } from './engines/availability.engine';
import { EventSeriesService } from './event-series.service';
import { EventMaterializationService } from './event-materialization.service';
import { EventType, EventStatus } from 'src/generated/prisma/client';
import {
  EventConflictException,
  EventValidationException,
  EventNotFoundException,
  EventErrorCode,
} from './exceptions/event.exceptions';

describe('EventsService (Orchestrator)', () => {
  let service: EventsService;
  let prisma: PrismaService;
  let availabilityEngine: AvailabilityEngine;

  // Mock implementation for Prisma $transaction
  const mockPrisma = {
    $transaction: jest.fn(async (callback) => {
      // Pass a mock transaction client to the callback
      return callback({
        event: {
          create: jest.fn().mockResolvedValue({ id: 'event-1', createdById: 'user-1' }),
          update: jest.fn().mockResolvedValue({ id: 'event-1', updatedById: 'user-1' }),
          delete: jest.fn().mockResolvedValue({ id: 'event-1' }),
          findUnique: mockPrisma.event.findUnique, // reuse the outer mock
        },
        generalEvent: {
          create: jest.fn().mockResolvedValue({ id: 'ge-1' }),
        },
        $queryRaw: jest.fn().mockResolvedValue([{ status: EventStatus.SCHEDULED }]),
      });
    }),
    event: {
      findUnique: jest.fn(),
      delete: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
    generalEvent: {
      findUnique: jest.fn(),
    },
    courseSeasonShift: {
      findUnique: jest.fn(),
    },
  };

  const mockAvailabilityEngine = {
    checkAvailability: jest.fn(),
  };

  const mockEventSeriesService = {};
  const mockEventMaterializationService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AvailabilityEngine, useValue: mockAvailabilityEngine },
        { provide: EventSeriesService, useValue: mockEventSeriesService },
        { provide: EventMaterializationService, useValue: mockEventMaterializationService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    prisma = module.get<PrismaService>(PrismaService);
    availabilityEngine = module.get<AvailabilityEngine>(AvailabilityEngine);

    jest.clearAllMocks();
  });

  describe('executeEventCreation', () => {
    const baseData = {
      startDate: new Date('2026-08-01T10:00:00Z'),
      endDate: new Date('2026-08-01T12:00:00Z'),
      eventType: EventType.GENERAL,
      locationId: 'loc-1',
    };

    it('should create an event successfully when location is available', async () => {
      mockAvailabilityEngine.checkAvailability.mockResolvedValue(true);

      const result = await service.executeEventCreation(baseData, 'user-1', async (tx, eventId) => {
        return { customEntityId: 'custom-1', eventId };
      });

      expect(availabilityEngine.checkAvailability).toHaveBeenCalledWith({
        locationId: 'loc-1',
        startDate: baseData.startDate,
        endDate: baseData.endDate,
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.event).toBeDefined();
      expect(result.specific.customEntityId).toBe('custom-1');
      expect(result.specific.eventId).toBe('event-1');
    });

    it('should throw EventValidationException if endDate <= startDate', async () => {
      const invalidData = {
        ...baseData,
        endDate: new Date('2026-08-01T09:00:00Z'), // Ends before it starts
      };

      await expect(
        service.executeEventCreation(invalidData, 'user-1', async () => ({}))
      ).rejects.toThrow(EventValidationException);

      expect(availabilityEngine.checkAvailability).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw EventConflictException if location is occupied', async () => {
      mockAvailabilityEngine.checkAvailability.mockResolvedValue({
        isAvailable: false,
        reason: 'LOCATION_OCCUPIED',
        conflictingEventId: 'conflict-1',
        conflictingEventTitle: 'Match A',
      });

      try {
        await service.executeEventCreation(baseData, 'user-1', async () => ({}));
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(EventConflictException);
        expect(e.response.errorCode).toBe(EventErrorCode.LOCATION_UNAVAILABLE);
        expect(e.response.metadata.conflictingEventId).toBe('conflict-1');
      }

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('executeEventUpdate', () => {
    it('should update event successfully', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        startDate: new Date('2026-08-01T10:00:00Z'),
        endDate: new Date('2026-08-01T12:00:00Z'),
        locationId: 'loc-1',
      });
      mockAvailabilityEngine.checkAvailability.mockResolvedValue(true);

      const updateData = {
        startDate: new Date('2026-08-01T11:00:00Z'), // Time changed, should check availability
      };

      const result = await service.executeEventUpdate('event-1', updateData, 'user-1', async () => ({
        updatedSpecific: true,
      }));

      expect(availabilityEngine.checkAvailability).toHaveBeenCalled();
      expect(result.specific.updatedSpecific).toBe(true);
    });

    it('should throw EventNotFoundException if event does not exist', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      await expect(
        service.executeEventUpdate('missing-id', {}, 'user-1', async () => ({}))
      ).rejects.toThrow(EventNotFoundException);
    });
  });

  describe('validateGeneralEventContext', () => {
    it('should pass with Institution only', async () => {
      await expect(
        (service as any).validateGeneralEventContext({
          institutionId: 'inst-1',
          teamSeasonCategoryId: null,
          courseSeasonId: null,
          courseSeasonShiftId: null,
        })
      ).resolves.not.toThrow();
    });

    it('should pass with TeamSeasonCategory only', async () => {
      await expect(
        (service as any).validateGeneralEventContext({
          institutionId: null,
          teamSeasonCategoryId: 'team-1',
          courseSeasonId: null,
          courseSeasonShiftId: null,
        })
      ).resolves.not.toThrow();
    });

    it('should pass with CourseSeason only', async () => {
      await expect(
        (service as any).validateGeneralEventContext({
          institutionId: null,
          teamSeasonCategoryId: null,
          courseSeasonId: 'course-1',
          courseSeasonShiftId: null,
        })
      ).resolves.not.toThrow();
    });

    it('should pass with CourseSeason + valid CourseSeasonShift', async () => {
      (prisma.courseSeasonShift.findUnique as jest.Mock).mockResolvedValueOnce({
        courseSeasonId: 'course-1',
      });

      await expect(
        (service as any).validateGeneralEventContext({
          institutionId: null,
          teamSeasonCategoryId: null,
          courseSeasonId: 'course-1',
          courseSeasonShiftId: 'shift-1',
        })
      ).resolves.not.toThrow();
    });

    it('should reject Institution + TeamSeasonCategory', async () => {
      await expect(
        (service as any).validateGeneralEventContext({
          institutionId: 'inst-1',
          teamSeasonCategoryId: 'team-1',
          courseSeasonId: null,
          courseSeasonShiftId: null,
        })
      ).rejects.toThrow(EventValidationException);
    });

    it('should reject Institution + CourseSeason', async () => {
      await expect(
        (service as any).validateGeneralEventContext({
          institutionId: 'inst-1',
          teamSeasonCategoryId: null,
          courseSeasonId: 'course-1',
          courseSeasonShiftId: null,
        })
      ).rejects.toThrow(EventValidationException);
    });

    it('should reject TeamSeasonCategory + CourseSeason', async () => {
      await expect(
        (service as any).validateGeneralEventContext({
          institutionId: null,
          teamSeasonCategoryId: 'team-1',
          courseSeasonId: 'course-1',
          courseSeasonShiftId: null,
        })
      ).rejects.toThrow(EventValidationException);
    });

    it('should reject Shift belonging to wrong CourseSeason', async () => {
      (prisma.courseSeasonShift.findUnique as jest.Mock).mockResolvedValueOnce({
        courseSeasonId: 'another-course-1',
      });

      await expect(
        (service as any).validateGeneralEventContext({
          institutionId: null,
          teamSeasonCategoryId: null,
          courseSeasonId: 'course-1',
          courseSeasonShiftId: 'shift-1',
        })
      ).rejects.toThrow(EventValidationException);
    });

    it('should reject UPDATE context change if previous context is not explicitly cleared', async () => {
      // Simulate an update payload where we set teamSeasonCategoryId but didn't nullify the existing institutionId
      const previousGeneralEvent = {
        institutionId: 'inst-1',
        teamSeasonCategoryId: null,
        courseSeasonId: null,
        courseSeasonShiftId: null,
      };

      const updatePayload = {
        teamSeasonCategoryId: 'team-1',
        // Omitted institutionId: null
      };

      // Service logic simulates merging
      const finalInstitutionId = updatePayload['institutionId'] !== undefined ? updatePayload['institutionId'] : previousGeneralEvent.institutionId;
      const finalTeamSeasonCategoryId = updatePayload.teamSeasonCategoryId !== undefined ? updatePayload.teamSeasonCategoryId : previousGeneralEvent.teamSeasonCategoryId;
      const finalCourseSeasonId = updatePayload['courseSeasonId'] !== undefined ? updatePayload['courseSeasonId'] : previousGeneralEvent.courseSeasonId;
      const finalCourseSeasonShiftId = updatePayload['courseSeasonShiftId'] !== undefined ? updatePayload['courseSeasonShiftId'] : previousGeneralEvent.courseSeasonShiftId;

      await expect(
        (service as any).validateGeneralEventContext({
          institutionId: finalInstitutionId,
          teamSeasonCategoryId: finalTeamSeasonCategoryId,
          courseSeasonId: finalCourseSeasonId,
          courseSeasonShiftId: finalCourseSeasonShiftId,
        })
      ).rejects.toThrow(EventValidationException);
    });

    it('should accept UPDATE context change if previous context IS explicitly cleared', async () => {
      // Simulate an update payload where we set teamSeasonCategoryId AND nullify the existing institutionId
      const previousGeneralEvent = {
        institutionId: 'inst-1',
        teamSeasonCategoryId: null,
        courseSeasonId: null,
        courseSeasonShiftId: null,
      };

      const updatePayload = {
        institutionId: null,
        teamSeasonCategoryId: 'team-1',
      };

      const finalInstitutionId = updatePayload.institutionId !== undefined ? updatePayload.institutionId : previousGeneralEvent.institutionId;
      const finalTeamSeasonCategoryId = updatePayload.teamSeasonCategoryId !== undefined ? updatePayload.teamSeasonCategoryId : previousGeneralEvent.teamSeasonCategoryId;
      const finalCourseSeasonId = updatePayload['courseSeasonId'] !== undefined ? updatePayload['courseSeasonId'] : previousGeneralEvent.courseSeasonId;
      const finalCourseSeasonShiftId = updatePayload['courseSeasonShiftId'] !== undefined ? updatePayload['courseSeasonShiftId'] : previousGeneralEvent.courseSeasonShiftId;

      await expect(
        (service as any).validateGeneralEventContext({
          institutionId: finalInstitutionId,
          teamSeasonCategoryId: finalTeamSeasonCategoryId,
          courseSeasonId: finalCourseSeasonId,
          courseSeasonShiftId: finalCourseSeasonShiftId,
        })
      ).resolves.not.toThrow();
    });
  });
});
