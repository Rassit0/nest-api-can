import { Test, TestingModule } from '@nestjs/testing';
import { PersonsService } from './persons.service';
import { PrismaService } from 'src/prisma.service';
import { StorageService } from '../storage/storage.service';

describe('PersonsService - getSecretarySummary (Cycle Enrollment & Charges Fix)', () => {
  let service: PersonsService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      person: {
        findUnique: jest.fn(),
      },
      playerMembership: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      studentMembership: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      charge: {
        findMany: jest.fn(),
      },
    };

    const mockStorage = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: StorageService,
          useValue: mockStorage,
        },
      ],
    }).compile();

    service = module.get<PersonsService>(PersonsService);
  });

  it('should include and map cycleEnrollment for a pending cycle charge', async () => {
    const personId = 'person-123';

    mockPrisma.person.findUnique.mockResolvedValue({
      id: personId,
      name: 'Carlos',
      lastName: 'Pérez',
      secondLastName: 'Mendoza',
      documentNumber: '1234567',
      phone: '77788899',
      email: 'carlos@example.com',
      imageUrl: null,
      players: null,
      students: { id: 'student-123' },
    });

    const cycleCharge = {
      id: 'charge-cycle-1',
      description: 'Inscripción Ciclo Octubre',
      amount: '350.00',
      pendingAmount: '350.00',
      adjustmentAmount: '0.00',
      adjustmentReason: null,
      dueDate: new Date('2026-10-25T00:00:00Z'),
      status: 'PENDING',
      parentChargeId: null,
      membershipCharges: [],
      studentCharges: [
        {
          type: 'ENROLLMENT',
          studentMembership: {
            id: 'sm-1',
            courseSeason: {
              course: { name: 'Natación Infantil' },
            },
            student: {
              id: 'student-123',
              person: {
                id: personId,
                name: 'Carlos',
                lastName: 'Pérez',
                secondLastName: 'Mendoza',
              },
            },
          },
        },
      ],
      cycleEnrollment: {
        id: 'cycle-101',
        status: 'PENDING',
        cycleStartDate: new Date('2026-10-01'),
        cycleEndDate: new Date('2026-10-31'),
        attempt: 1,
        cancellationReason: null,
        cancelledAt: null,
        courseSeason: {
          id: 'cs-1',
          course: { name: 'Natación Infantil' },
        },
        courseSeasonShift: {
          id: 'css-1',
          shift: { name: 'Mañana (08:00 - 10:00)' },
        },
        studentMembership: {
          id: 'sm-1',
          student: {
            id: 'student-123',
            person: {
              id: personId,
              name: 'Carlos',
              lastName: 'Pérez',
              secondLastName: 'Mendoza',
            },
          },
        },
      },
      payments: [],
      accountCharge: null,
    };

    mockPrisma.charge.findMany.mockResolvedValue([cycleCharge]);

    const result = await service.getSecretarySummary(personId);

    expect(result.data.pendingCharges).toHaveLength(1);
    const charge = result.data.pendingCharges[0];

    // Assertions for cycle charge
    expect(charge.id).toBe('charge-cycle-1');
    expect(charge.status).toBe('PENDING');
    expect(charge.type).toBe('STUDENT');
    expect(charge.amount).toBe(350);
    expect(charge.pendingAmount).toBe(350);

    // CRITICAL: cycleEnrollment must be present and correctly mapped
    expect(charge.cycleEnrollment).toBeDefined();
    expect(charge.cycleEnrollment).not.toBeNull();
    expect(charge.cycleEnrollment?.id).toBe('cycle-101');
    expect(charge.cycleEnrollment?.status).toBe('PENDING');
    expect(charge.cycleEnrollment?.courseSeason?.course?.name).toBe('Natación Infantil');
    expect(charge.cycleEnrollment?.courseSeasonShift?.shift?.name).toBe('Mañana (08:00 - 10:00)');
    expect(charge.cycleEnrollment?.studentMembership?.student?.person?.name).toBe('Carlos');
    expect(charge.cycleEnrollment?.studentMembership?.student?.person?.lastName).toBe('Pérez');

    // studentCharges must also contain student and person details
    expect(charge.studentCharges).toHaveLength(1);
    expect(charge.studentCharges[0].studentMembership?.student?.person?.name).toBe('Carlos');
  });

  it('should return cycleEnrollment as null for manual or non-cycle charges', async () => {
    const personId = 'person-123';

    mockPrisma.person.findUnique.mockResolvedValue({
      id: personId,
      name: 'Carlos',
      lastName: 'Pérez',
      players: null,
      students: null,
    });

    const manualCharge = {
      id: 'charge-manual-1',
      description: 'Cobro de uniforme',
      amount: '120.00',
      pendingAmount: '120.00',
      adjustmentAmount: '0.00',
      adjustmentReason: null,
      dueDate: new Date('2026-10-30T00:00:00Z'),
      status: 'PENDING',
      parentChargeId: null,
      membershipCharges: [],
      studentCharges: [],
      cycleEnrollment: null,
      payments: [],
      accountCharge: {
        category: { name: 'Indumentaria' },
      },
    };

    mockPrisma.charge.findMany.mockResolvedValue([manualCharge]);

    const result = await service.getSecretarySummary(personId);

    expect(result.data.pendingCharges).toHaveLength(1);
    const charge = result.data.pendingCharges[0];

    expect(charge.id).toBe('charge-manual-1');
    expect(charge.type).toBe('ACCOUNT');
    expect(charge.originName).toBe('Indumentaria');
    expect(charge.cycleEnrollment).toBeNull();
  });
});
