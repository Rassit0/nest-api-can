import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityEngine } from './availability.engine';
import { PrismaService } from 'src/prisma.service';
import { ClsService } from 'nestjs-cls';

describe('AvailabilityEngine (Integration)', () => {
  let engine: AvailabilityEngine;
  let prisma: PrismaService;

  // Test data IDs
  let rootLocationId: string;
  let childLocationId: string;
  let grandChildLocationId: string;
  
  let event1Id: string; // Event in root
  let event2Id: string; // Event in child

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityEngine, 
        PrismaService,
        { provide: ClsService, useValue: { get: () => null } }
      ],
    }).compile();

    engine = module.get<AvailabilityEngine>(AvailabilityEngine);
    prisma = module.get<PrismaService>(PrismaService);

    // Clean up previous test data if any
    await prisma.location.deleteMany({ where: { name: { startsWith: 'TestLoc_GrandChild' } } });
    await prisma.location.deleteMany({ where: { name: { startsWith: 'TestLoc_Child' } } });
    await prisma.location.deleteMany({ where: { name: { startsWith: 'TestLoc_Root' } } });
    await prisma.location.deleteMany({ where: { name: { startsWith: 'TestLoc_' } } }); // fallback
    await prisma.event.deleteMany({ where: { title: { startsWith: 'TestEvent_' } } });



    // Create a hierarchy of locations: Root -> Child -> GrandChild
    const root = await prisma.location.create({
      data: { name: 'TestLoc_Root', maxConcurrentEvents: 1, address: 'Fake Address' }
    });
    rootLocationId = root.id;

    const child = await prisma.location.create({
      data: { name: 'TestLoc_Child', maxConcurrentEvents: 1, parentId: root.id, address: 'Fake Address' }
    });
    childLocationId = child.id;

    const grandChild = await prisma.location.create({
      data: { name: 'TestLoc_GrandChild', maxConcurrentEvents: 1, parentId: child.id, address: 'Fake Address' }
    });
    grandChildLocationId = grandChild.id;

    // Create a blocking event in the root location from 10:00 to 12:00
    const e1 = await prisma.event.create({
      data: {
        title: 'TestEvent_RootBlock',
        eventType: 'GENERAL',
        startDate: new Date('2026-08-01T10:00:00.000Z'),
        endDate: new Date('2026-08-01T12:00:00.000Z'),
        locationId: rootLocationId,
      }
    });
    event1Id = e1.id;

    // Create a blocking event in the child location from 14:00 to 16:00
    const e2 = await prisma.event.create({
      data: {
        title: 'TestEvent_ChildBlock',
        eventType: 'GENERAL',
        startDate: new Date('2026-08-01T14:00:00.000Z'),
        endDate: new Date('2026-08-01T16:00:00.000Z'),
        locationId: childLocationId,
      }
    });
    event2Id = e2.id;
  });

  afterAll(async () => {
    // Cleanup
    if (prisma) {
      await prisma.event.deleteMany({ where: { title: { startsWith: 'TestEvent_' } } });
      await prisma.location.deleteMany({ where: { name: { startsWith: 'TestLoc_GrandChild' } } });
      await prisma.location.deleteMany({ where: { name: { startsWith: 'TestLoc_Child' } } });
      await prisma.location.deleteMany({ where: { name: { startsWith: 'TestLoc_Root' } } });
      await prisma.location.deleteMany({ where: { name: { startsWith: 'TestLoc_' } } });
      await prisma.$disconnect();
    }
  });

  it('should allow an event when there is no overlap', async () => {
    const result = await engine.checkAvailability({
      locationId: grandChildLocationId,
      startDate: new Date('2026-08-01T08:00:00.000Z'),
      endDate: new Date('2026-08-01T09:30:00.000Z'),
    });
    expect(result).toBe(true);
  });

  it('should block if trying to book a descendant when the ancestor (root) is occupied', async () => {
    // Root is occupied 10:00 to 12:00. GrandChild booking inside this range should fail.
    const result = await engine.checkAvailability({
      locationId: grandChildLocationId,
      startDate: new Date('2026-08-01T10:30:00.000Z'),
      endDate: new Date('2026-08-01T11:30:00.000Z'),
    });
    expect(result).not.toBe(true);
    if (result !== true) {
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toBe('PARENT_LOCATION_OCCUPIED');
      expect(result.conflictingEventId).toBe(event1Id);
    }
  });

  it('should block if trying to book an ancestor (root) when a descendant (child) is occupied', async () => {
    // Child is occupied 14:00 to 16:00. Root booking inside this range should fail.
    const result = await engine.checkAvailability({
      locationId: rootLocationId,
      startDate: new Date('2026-08-01T14:30:00.000Z'),
      endDate: new Date('2026-08-01T15:30:00.000Z'),
    });
    expect(result).not.toBe(true);
    if (result !== true) {
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toBe('CHILD_LOCATION_OCCUPIED');
      expect(result.conflictingEventId).toBe(event2Id);
    }
  });

  it('should block if the exact location is occupied', async () => {
    // Child is occupied 14:00 to 16:00. Child booking inside this range should fail.
    const result = await engine.checkAvailability({
      locationId: childLocationId,
      startDate: new Date('2026-08-01T13:30:00.000Z'),
      endDate: new Date('2026-08-01T14:30:00.000Z'), // overlaps 14:00-14:30
    });
    expect(result).not.toBe(true);
    if (result !== true) {
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toBe('LOCATION_OCCUPIED');
      expect(result.conflictingEventId).toBe(event2Id);
    }
  });

  it('should ignore an event if excludeEventId matches the conflicting event', async () => {
    // Overlaps with root event (10:00-12:00), but we exclude event1Id
    const result = await engine.checkAvailability({
      locationId: rootLocationId,
      startDate: new Date('2026-08-01T10:30:00.000Z'),
      endDate: new Date('2026-08-01T11:30:00.000Z'),
      excludeEventId: event1Id
    });
    expect(result).toBe(true);
  });
});
