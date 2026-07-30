import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from 'src/prisma.service';
import { AvailabilityEngine } from './engines/availability.engine';
import { EventType } from 'src/generated/prisma/client';
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
        },
        generalEvent: {
          create: jest.fn().mockResolvedValue({ id: 'ge-1' }),
        },
      });
    }),
    event: {
      findUnique: jest.fn(),
      delete: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
    generalEvent: {
      findUnique: jest.fn(),
    },
  };

  const mockAvailabilityEngine = {
    checkAvailability: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AvailabilityEngine, useValue: mockAvailabilityEngine },
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
        startDate: new Date('2026-08-01T13:00:00Z'), // Time changed, should check availability
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
});
