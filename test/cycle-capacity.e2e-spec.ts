import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { CycleEnrollmentStatus, StatusCharge, StatusCourseSeason, StudentMembershipStatus, TypeMembershipCharge, SeasonStatus } from 'src/generated/prisma/client';
import { StudentCycleManagerService } from '../src/student-charges/services/student-cycle-manager.service';
import { StudentChargesService } from '../src/student-charges/student-charges.service';
import { randomUUID } from 'crypto';

describe('Cycle Capacity READ-ONLY and Concurrency', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cycleManagerService: StudentCycleManagerService;
  let chargesService: StudentChargesService;
  let jwtToken: string;

  const testIds = {
    institution: randomUUID(),
    season: randomUUID(),
    courseSeason: randomUUID(),
    shiftA: randomUUID(),
    shiftB: randomUUID(),
    shiftUnlimited: randomUUID(),
    person1: randomUUID(),
    student1: randomUUID(),
    person2: randomUUID(),
    student2: randomUUID(),
    user: randomUUID(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    cycleManagerService = app.get(StudentCycleManagerService);
    chargesService = app.get(StudentChargesService);

    // Create a mock user and sign a JWT token (assuming a bypass or mocked auth for e2e, but since we use guards we should just bypass auth for the test if possible, or inject a mock guard. Wait, we can just insert a user and use the token).
    // To simplify, we will just call the service methods directly for capacity, and only use supertest if we need it for concurrency, but for concurrency we can just call `cycleManagerService.enrollCyclesToMembership` in parallel. Calling the service directly is an integration test anyway.

    // 1. Setup DB
    await prisma.institution.create({ data: { id: testIds.institution, name: 'Test Inst' } as any });
    await prisma.season.create({
      data: {
        id: testIds.season,
        name: 'Season Test',
        startDate: new Date('2026-09-01T00:00:00Z'),
        endDate: new Date('2026-12-31T23:59:59Z'),
        status: SeasonStatus.ACTIVE,
      } as any,
    });

    await prisma.courseSeason.create({
      data: {
        id: testIds.courseSeason,
        seasonId: testIds.season,
        courseId: null,
        name: 'Course Test',
        status: StatusCourseSeason.ACTIVE,
        billingConfig: {
          create: {
            billingFrequency: 'MONTHLY',
            seasonFee: 0,
            monthlyFee: 100,
          } as any,
        },
      } as any,
    });

    await prisma.courseSeasonShift.createMany({
      data: [
        { id: testIds.shiftA, courseSeasonId: testIds.courseSeason, maxMembers: 1, availableDays: [] } as any,
        { id: testIds.shiftB, courseSeasonId: testIds.courseSeason, maxMembers: 2, availableDays: [] } as any,
        { id: testIds.shiftUnlimited, courseSeasonId: testIds.courseSeason, maxMembers: null, availableDays: [] } as any,
      ],
    });

    await prisma.person.createMany({
      data: [
        { id: testIds.person1, firstName: 'P1', lastName: 'L1', documentType: 'DNI', documentNumber: '111', isStudent: true, gender: 'M' } as any,
        { id: testIds.person2, firstName: 'P2', lastName: 'L2', documentType: 'DNI', documentNumber: '222', isStudent: true, gender: 'M' } as any,
      ],
    });

    await prisma.student.createMany({
      data: [
        { id: testIds.student1, personId: testIds.person1 } as any,
        { id: testIds.student2, personId: testIds.person2 } as any,
      ],
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.cycleEnrollment.deleteMany({ where: { courseSeasonId: testIds.courseSeason } });
    await prisma.studentMembership.deleteMany({ where: { courseSeasonId: testIds.courseSeason } });
    await prisma.courseSeasonShift.deleteMany({ where: { courseSeasonId: testIds.courseSeason } });
    await prisma.courseSeasonBillingConfig.deleteMany({ where: { courseSeasonId: testIds.courseSeason } });
    await prisma.courseSeason.deleteMany({ where: { id: testIds.courseSeason } });
    await prisma.season.deleteMany({ where: { id: testIds.season } });
    await prisma.student.deleteMany({ where: { id: { in: [testIds.student1, testIds.student2] } } });
    await prisma.person.deleteMany({ where: { id: { in: [testIds.person1, testIds.person2] } } });
    await prisma.institution.deleteMany({ where: { id: testIds.institution } });
    await app.close();
  });

  describe('Cycle Capacity Logic (Occupancy)', () => {
    it('should return empty cycles when no enrollments exist', async () => {
      const capacities = await chargesService.getCycleCapacity(testIds.courseSeason, testIds.shiftA);
      expect(capacities.length).toBeGreaterThan(0);
      expect(capacities[0].occupiedSpots).toBe(0);
      expect(capacities[0].status).toBe('AVAILABLE');
      expect(capacities[0].maxMembers).toBe(1);
    });

    it('should respect maxMembers = null (unlimited)', async () => {
      const capacities = await chargesService.getCycleCapacity(testIds.courseSeason, testIds.shiftUnlimited);
      expect(capacities[0].maxMembers).toBeNull();
      expect(capacities[0].availableSpots).toBeNull();
      expect(capacities[0].status).toBe('AVAILABLE');
    });

    it('should correctly count CONFIRMED enrollments', async () => {
      const memId = randomUUID();
      await prisma.studentMembership.create({
        data: { id: memId, studentId: testIds.student1, courseSeasonId: testIds.courseSeason, courseSeasonShiftId: testIds.shiftB, status: StudentMembershipStatus.ACTIVE } as any,
      });
      await prisma.cycleEnrollment.create({
        data: {
          studentMembershipId: memId, courseSeasonId: testIds.courseSeason, courseSeasonShiftId: testIds.shiftB,
          cycleStartDate: new Date('2026-09-01T00:00:00Z'), cycleEndDate: new Date('2026-10-01T00:00:00Z'),
          effectiveStartDate: new Date('2026-09-01T00:00:00Z'), status: CycleEnrollmentStatus.CONFIRMED,
        },
      });

      const capacities = await chargesService.getCycleCapacity(testIds.courseSeason, testIds.shiftB);
      const sepCycle = capacities.find(c => c.cycleStartDate.getTime() === new Date('2026-09-01T00:00:00Z').getTime());
      expect(sepCycle.occupiedSpots).toBe(1);
      expect(sepCycle.status).toBe('AVAILABLE');
    });

    it('should NOT count CANCELLED or expired PENDING', async () => {
      const memId = randomUUID();
      await prisma.studentMembership.create({
        data: { id: memId, studentId: testIds.student2, courseSeasonId: testIds.courseSeason, courseSeasonShiftId: testIds.shiftB, status: StudentMembershipStatus.ACTIVE } as any,
      });
      
      // Expired pending
      await prisma.cycleEnrollment.create({
        data: {
          studentMembershipId: memId, courseSeasonId: testIds.courseSeason, courseSeasonShiftId: testIds.shiftB,
          cycleStartDate: new Date('2026-09-01T00:00:00Z'), cycleEndDate: new Date('2026-10-01T00:00:00Z'),
          effectiveStartDate: new Date('2026-09-01T00:00:00Z'), status: CycleEnrollmentStatus.PENDING,
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h ago
        },
      });

      // Cancelled
      await prisma.cycleEnrollment.create({
        data: {
          studentMembershipId: memId, courseSeasonId: testIds.courseSeason, courseSeasonShiftId: testIds.shiftB,
          cycleStartDate: new Date('2026-10-01T00:00:00Z'), cycleEndDate: new Date('2026-11-01T00:00:00Z'),
          effectiveStartDate: new Date('2026-10-01T00:00:00Z'), status: CycleEnrollmentStatus.CANCELLED,
        },
      });

      const capacities = await chargesService.getCycleCapacity(testIds.courseSeason, testIds.shiftB);
      const sepCycle = capacities.find(c => c.cycleStartDate.getTime() === new Date('2026-09-01T00:00:00Z').getTime());
      const octCycle = capacities.find(c => c.cycleStartDate.getTime() === new Date('2026-10-01T00:00:00Z').getTime());
      
      // The previous test added 1 to sepCycle for student 1, so it should remain 1, not 2
      expect(sepCycle.occupiedSpots).toBe(1);
      expect(octCycle.occupiedSpots).toBe(0);
    });

    it('should isolate capacity by shift (Historical Enrollment isolation)', async () => {
      // Create confirmed enrollment in Shift A
      const memId = randomUUID();
      await prisma.studentMembership.create({
        data: { id: memId, studentId: testIds.student1, courseSeasonId: testIds.courseSeason, courseSeasonShiftId: testIds.shiftB /* moved to B */, status: StudentMembershipStatus.ACTIVE } as any,
      });
      
      // But historically they were in Shift A for September
      await prisma.cycleEnrollment.create({
        data: {
          studentMembershipId: memId, courseSeasonId: testIds.courseSeason, courseSeasonShiftId: testIds.shiftA,
          cycleStartDate: new Date('2026-09-01T00:00:00Z'), cycleEndDate: new Date('2026-10-01T00:00:00Z'),
          effectiveStartDate: new Date('2026-09-01T00:00:00Z'), status: CycleEnrollmentStatus.CONFIRMED,
        },
      });

      const capsA = await chargesService.getCycleCapacity(testIds.courseSeason, testIds.shiftA);
      const capsB = await chargesService.getCycleCapacity(testIds.courseSeason, testIds.shiftB);

      const sepA = capsA.find(c => c.cycleStartDate.getTime() === new Date('2026-09-01T00:00:00Z').getTime());
      const sepB = capsB.find(c => c.cycleStartDate.getTime() === new Date('2026-09-01T00:00:00Z').getTime());

      expect(sepA.occupiedSpots).toBe(1); // Shift A has maxMembers = 1
      expect(sepA.status).toBe('FULL'); // Because 1/1
      
      // Shift B does not get affected by Shift A's historical enrollment
      // (Except for the 1 we added in test 3, so it should be 1, not 2)
      expect(sepB.occupiedSpots).toBe(1); 
    });

    it('should continue to occupy seats if WITHDRAWN or SUSPENDED', async () => {
      const memId = randomUUID();
      await prisma.studentMembership.create({
        data: { id: memId, studentId: testIds.student1, courseSeasonId: testIds.courseSeason, courseSeasonShiftId: testIds.shiftA, status: StudentMembershipStatus.WITHDRAWN } as any,
      });
      await prisma.cycleEnrollment.create({
        data: {
          studentMembershipId: memId, courseSeasonId: testIds.courseSeason, courseSeasonShiftId: testIds.shiftA,
          cycleStartDate: new Date('2026-10-01T00:00:00Z'), cycleEndDate: new Date('2026-11-01T00:00:00Z'),
          effectiveStartDate: new Date('2026-10-01T00:00:00Z'), status: CycleEnrollmentStatus.CONFIRMED,
        },
      });

      const capsA = await chargesService.getCycleCapacity(testIds.courseSeason, testIds.shiftA);
      const octA = capsA.find(c => c.cycleStartDate.getTime() === new Date('2026-10-01T00:00:00Z').getTime());
      
      expect(octA.occupiedSpots).toBe(1);
      expect(octA.status).toBe('FULL');
    });
  });

  describe('Concurrency and Atomic Multi-cycle Rejection', () => {
    it('should reject multi-cycle transaction if ONE cycle is full', async () => {
      // Shift A maxMembers is 1. September is FULL, November is Empty.
      // If we try to enroll in Sep + Nov, it should rollback completely.
      
      const memId = randomUUID();
      const membership = await prisma.studentMembership.create({
        data: { id: memId, studentId: testIds.student2, courseSeasonId: testIds.courseSeason, courseSeasonShiftId: testIds.shiftA, status: StudentMembershipStatus.ACTIVE } as any,
        include: { courseSeason: { include: { season: true } } }
      });

      const cyclesToEnroll = [
        { cycleStartDate: new Date('2026-09-01T00:00:00Z'), cycleEndDate: new Date('2026-10-01T00:00:00Z'), billingYear: 2026, billingMonth: 9 },
        { cycleStartDate: new Date('2026-11-01T00:00:00Z'), cycleEndDate: new Date('2026-12-01T00:00:00Z'), billingYear: 2026, billingMonth: 11 },
      ];

      await expect(
        prisma.$transaction(async (tx) => {
          await cycleManagerService.enrollCyclesToMembership(
            membership,
            cyclesToEnroll as any,
            new Date(),
            { chargeInitialCycle: true, isSeasonFeeOnly: false, billingFrequency: 'MONTHLY' },
            tx
          );
        })
      ).rejects.toThrow(/El cupo de este ciclo ya no está disponible/);

      // Verify transaction rollback: No enrollments created for November
      const novEnrollments = await prisma.cycleEnrollment.findMany({
        where: { studentMembershipId: memId }
      });
      expect(novEnrollments.length).toBe(0);
    });

    it('should prevent race conditions on last seat (SELECT FOR UPDATE)', async () => {
      // Shift A maxMembers is 1. December is empty. 2 parallel transactions trying to enroll.
      // One should succeed, one should fail.

      const mem1 = await prisma.studentMembership.create({
        data: { id: randomUUID(), studentId: testIds.student1, courseSeasonId: testIds.courseSeason, courseSeasonShiftId: testIds.shiftA, status: StudentMembershipStatus.ACTIVE } as any,
        include: { courseSeason: { include: { season: true } } }
      });
      const mem2 = await prisma.studentMembership.create({
        data: { id: randomUUID(), studentId: testIds.student2, courseSeasonId: testIds.courseSeason, courseSeasonShiftId: testIds.shiftA, status: StudentMembershipStatus.ACTIVE } as any,
        include: { courseSeason: { include: { season: true } } }
      });

      const cyclesToEnroll = [
        { cycleStartDate: new Date('2026-12-01T00:00:00Z'), cycleEndDate: new Date('2027-01-01T00:00:00Z'), billingYear: 2026, billingMonth: 12 },
      ];

      const p1 = prisma.$transaction(async (tx) => {
        await cycleManagerService.enrollCyclesToMembership(
          mem1, cyclesToEnroll as any, new Date(), { chargeInitialCycle: true, isSeasonFeeOnly: false, billingFrequency: 'MONTHLY' }, tx
        );
      });

      const p2 = prisma.$transaction(async (tx) => {
        await cycleManagerService.enrollCyclesToMembership(
          mem2, cyclesToEnroll as any, new Date(), { chargeInitialCycle: true, isSeasonFeeOnly: false, billingFrequency: 'MONTHLY' }, tx
        );
      });

      const results = await Promise.allSettled([p1, p2]);
      
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Ensure that only 1 cycle was created for December
      const decEnrollments = await prisma.cycleEnrollment.findMany({
        where: { courseSeasonShiftId: testIds.shiftA, cycleStartDate: new Date('2026-12-01T00:00:00Z') }
      });
      
      expect(decEnrollments.length).toBe(1); // Never > maxMembers
    });
  });
});
