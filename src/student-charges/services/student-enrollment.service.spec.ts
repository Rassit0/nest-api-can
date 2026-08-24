import { Test, TestingModule } from '@nestjs/testing';
import { StudentEnrollmentService } from './student-enrollment.service';
import { PrismaService } from 'src/prisma.service';
import { StudentMembershipRepository } from '../repositories/student-membership.repository';
import { StudentPreviewService } from './student-preview.service';
import { DateUtils } from 'src/utils/date.utils';
import { TypeMembershipCharge, StatusCharge } from 'src/generated/prisma/client';
import { StudentCycleManagerService } from './student-cycle-manager.service';

describe('StudentEnrollmentService (FASE 2.6 - On-Demand Enrollment)', () => {
  let service: StudentEnrollmentService;
  let prismaMock: any;
  let membershipRepoMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(async (cb) => {
        return await cb(prismaMock);
      }),
      $queryRaw: jest.fn().mockResolvedValue([{ maxMembers: null }]),
      studentCharge: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      charge: {
        create: jest.fn().mockImplementation((data) => ({ id: 'mock-charge-id', ...data.data })),
      },
      cycleEnrollment: {
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation((data) => ({ id: 'mock-ce-id', ...data.data })),
      },
    };

    membershipRepoMock = {
      getMembershipById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentEnrollmentService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StudentMembershipRepository, useValue: membershipRepoMock },
        { provide: StudentPreviewService, useValue: {} },
        StudentCycleManagerService,
      ],
    }).compile();

    service = module.get<StudentEnrollmentService>(StudentEnrollmentService);
  });

  const getMockMembership = (overrides = {}) => {
    return {
      id: 'mock-membership-123',
      startedAt: new Date('2026-08-01T00:00:00.000Z'),
      courseSeason: {
        season: {
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T23:59:59.000Z'),
        },
        billingConfig: {
          isEngineActive: true,
          billingFrequency: 'MONTHLY',
          billingType: 'MONTHLY_ONLY',
          registrationFee: 0,
          recurringFee: 100,
          prorateFirstRecurringFee: true,
          prorationEnabled: true,
        },
        pauses: [],
      },
      paymentPlan: {
        isSinglePayment: false,
        advanceCycles: 1,
      },
      pauses: [],
      studentDiscounts: [],
      isMigrated: false,
      ...overrides,
    };
  };

  it('Inscripción normal al inicio del ciclo (crea 1 CE y 1 Charge recurrent)', async () => {
    const mem = getMockMembership();
    membershipRepoMock.getMembershipById.mockResolvedValue(mem);

    await service.enrollInitialCycle(mem.id);

    // Debe verificar inscripción (no hay matrícula en este mock porque regFee = 0)
    // Debería crear el Charge y el CE para Agosto
    expect(prismaMock.charge.create).toHaveBeenCalled();
    expect(prismaMock.cycleEnrollment.create).toHaveBeenCalled();
    
    const ceCall = prismaMock.cycleEnrollment.create.mock.calls[0][0].data;
    expect(ceCall.cycleStartDate).toEqual(new Date('2026-08-01T00:00:00.000Z'));
    expect(ceCall.effectiveStartDate).toEqual(new Date('2026-08-01T00:00:00.000Z'));

    const chargeCall = prismaMock.charge.create.mock.calls[0][0].data;
    expect(chargeCall.amount).toBe(100); // Completo sin prorrateo
  });

  it('Inscripción a mitad de ciclo aplica prorrateo', async () => {
    const mem = getMockMembership({ startedAt: new Date('2026-08-16T00:00:00.000Z') });
    membershipRepoMock.getMembershipById.mockResolvedValue(mem);

    await service.enrollInitialCycle(mem.id);

    const ceCall = prismaMock.cycleEnrollment.create.mock.calls[0][0].data;
    // El ciclo base sigue siendo el mismo matemáticamente (1 Agosto - 1 Septiembre)
    expect(ceCall.cycleStartDate).toEqual(new Date('2026-08-01T00:00:00.000Z'));
    // Pero entró el 16
    expect(ceCall.effectiveStartDate).toEqual(new Date('2026-08-16T00:00:00.000Z'));

    const chargeCall = prismaMock.charge.create.mock.calls[0][0].data;
    expect(chargeCall.amount).toBeLessThan(100);
    expect(chargeCall.description).toContain('Prorrateado');
  });

  it('Inscripción con pausa descuenta días', async () => {
    const mem = getMockMembership({ 
       pauses: [{ startDate: new Date('2026-08-10T00:00:00.000Z'), endDate: new Date('2026-08-12T00:00:00.000Z') }] // 2 días pausa
    });
    membershipRepoMock.getMembershipById.mockResolvedValue(mem);

    await service.enrollInitialCycle(mem.id);

    const chargeCall = prismaMock.charge.create.mock.calls[0][0].data;
    expect(chargeCall.amount).toBeLessThan(100); // Descontó los 2 días de pausa
    expect(chargeCall.description).toContain('Prorrateado');
  });

  it('Pausa que cruza los límites se recorta', async () => {
    const mem = getMockMembership({ 
       pauses: [{ startDate: new Date('2026-08-30T00:00:00.000Z'), endDate: new Date('2026-09-05T00:00:00.000Z') }]
    });
    // El ciclo 1 es Agosto (01-08 al 01-09). La pausa empieza el 30, así que en Agosto descuenta 2 días.
    membershipRepoMock.getMembershipById.mockResolvedValue(mem);

    await service.enrollInitialCycle(mem.id);

    const chargeCall = prismaMock.charge.create.mock.calls[0][0].data;
    expect(chargeCall.amount).toBeLessThan(100);
  });

  it('Exoneración de ciclo inicial crea CycleEnrollment pero NO crea Charge para cuota', async () => {
    const mem = getMockMembership({ startedAt: new Date('2026-08-01T00:00:00.000Z') });
    membershipRepoMock.getMembershipById.mockResolvedValue(mem);

    await service.enrollInitialCycle(mem.id, { chargeInitialCycle: false, chargeRegistration: false });

    // Se verifica que SE LLAMÓ a create de CycleEnrollment
    expect(prismaMock.cycleEnrollment.create).toHaveBeenCalled();
    const ceCall = prismaMock.cycleEnrollment.create.mock.calls[0][0].data;
    expect(ceCall.chargeId).toBeNull(); // Porque no se creó charge para la cuota
    expect(ceCall.status).toBe('CONFIRMED'); // Porque el importe es cobrado como 0 (exonerado)
    
    // Se verifica que NO SE LLAMÓ a create de Charge
    expect(prismaMock.charge.create).not.toHaveBeenCalled();
    expect(prismaMock.studentCharge.create).not.toHaveBeenCalled();
  });

  it('Ciclo duplicado es rechazado', async () => {
    const mem = getMockMembership();
    membershipRepoMock.getMembershipById.mockResolvedValue(mem);
    prismaMock.cycleEnrollment.findUnique.mockResolvedValue({ id: 'exists' }); // Simula duplicado

    await service.enrollInitialCycle(mem.id);

    // No debe crear CycleEnrollment ni Charge para ese ciclo
    expect(prismaMock.charge.create).not.toHaveBeenCalled();
    expect(prismaMock.cycleEnrollment.create).not.toHaveBeenCalled();
  });

  it('Ciclo fuera de Season (effectiveStart >= effectiveEnd) es rechazado', async () => {
    // Si la season termina el 2026-08-15
    const mem = getMockMembership({
        startedAt: new Date('2026-08-16T00:00:00.000Z'), // Empieza DESPUÉS del fin de la season
        courseSeason: {
           ...getMockMembership().courseSeason,
           season: {
               startDate: new Date('2026-08-01T00:00:00.000Z'),
               endDate: new Date('2026-08-15T00:00:00.000Z')
           }
        }
    });
    membershipRepoMock.getMembershipById.mockResolvedValue(mem);

    await service.enrollInitialCycle(mem.id);
    expect(prismaMock.cycleEnrollment.create).not.toHaveBeenCalled();
  });

  it('SINGLE genera un único CycleEnrollment para toda la season', async () => {
    const mem = getMockMembership({
        paymentPlan: { isSinglePayment: true },
        courseSeason: {
            ...getMockMembership().courseSeason,
            billingConfig: { ...getMockMembership().courseSeason.billingConfig, billingType: 'SINGLE_ONLY', seasonFee: 500 }
        }
    });
    membershipRepoMock.getMembershipById.mockResolvedValue(mem);

    await service.enrollInitialCycle(mem.id);

    expect(prismaMock.cycleEnrollment.create).toHaveBeenCalledTimes(1);
    const chargeCall = prismaMock.charge.create.mock.calls[0][0].data;
    expect(chargeCall.amount).toBe(500); // SeasonFee completo
  });

  it('MONTHLY truncado + prorrateo activado cobra proporcional', async () => {
    const mem = getMockMembership({
        startedAt: new Date('2026-08-01T00:00:00.000Z'),
        courseSeason: {
            ...getMockMembership().courseSeason,
            season: {
                startDate: new Date('2026-08-01T00:00:00.000Z'),
                endDate: new Date('2026-08-20T00:00:00.000Z') // Termina a los 20 días
            },
            billingConfig: { ...getMockMembership().courseSeason.billingConfig, prorateLastRecurringFee: true, recurringFee: 300 }
        }
    });
    membershipRepoMock.getMembershipById.mockResolvedValue(mem);
    prismaMock.charge.create.mockClear();

    await service.enrollInitialCycle(mem.id);

    const chargeCall = prismaMock.charge.create.mock.calls[0][0].data;
    // 19 días de 31 días en agosto (01-08 al 20-08)
    expect(chargeCall.amount).toBeLessThan(300);
  });

  it('MONTHLY truncado + prorrateo desactivado cobra completo', async () => {
    const mem = getMockMembership({
        startedAt: new Date('2026-08-01T00:00:00.000Z'),
        courseSeason: {
            ...getMockMembership().courseSeason,
            season: {
                startDate: new Date('2026-08-01T00:00:00.000Z'),
                endDate: new Date('2026-08-20T00:00:00.000Z')
            },
            billingConfig: { ...getMockMembership().courseSeason.billingConfig, prorateLastRecurringFee: false, recurringFee: 300 }
        }
    });
    membershipRepoMock.getMembershipById.mockResolvedValue(mem);
    prismaMock.charge.create.mockClear();

    await service.enrollInitialCycle(mem.id);

    const chargeCall = prismaMock.charge.create.mock.calls[0][0].data;
    expect(chargeCall.amount).toBe(300); // No recorta precio aunque dura menos días
  });

  it('WEEKLY normal', async () => {
    const mem = getMockMembership({
        courseSeason: {
            ...getMockMembership().courseSeason,
            billingConfig: { ...getMockMembership().courseSeason.billingConfig, billingFrequency: 'WEEKLY', recurringFee: 50 }
        }
    });
    membershipRepoMock.getMembershipById.mockResolvedValue(mem);
    prismaMock.charge.create.mockClear();
    prismaMock.cycleEnrollment.create.mockClear();

    await service.enrollInitialCycle(mem.id);

    const ceCall = prismaMock.cycleEnrollment.create.mock.calls[0][0].data;
    expect(ceCall.cycleEndDate).toEqual(new Date('2026-08-08T00:00:00.000Z')); // 7 días después
    const chargeCall = prismaMock.charge.create.mock.calls[0][0].data;
    expect(chargeCall.amount).toBe(50);
  });

  it('WEEKLY truncado cobra proporcional si prorateLastRecurringFee=true', async () => {
    const mem = getMockMembership({
        courseSeason: {
            ...getMockMembership().courseSeason,
            season: {
                startDate: new Date('2026-08-01T00:00:00.000Z'),
                endDate: new Date('2026-08-05T00:00:00.000Z') // Solo 4 días de los 7
            },
            billingConfig: { ...getMockMembership().courseSeason.billingConfig, billingFrequency: 'WEEKLY', prorateLastRecurringFee: true, recurringFee: 70 }
        }
    });
    membershipRepoMock.getMembershipById.mockResolvedValue(mem);
    prismaMock.charge.create.mockClear();

    await service.enrollInitialCycle(mem.id);

    const chargeCall = prismaMock.charge.create.mock.calls[0][0].data;
    // 4 / 7 * 70 = 40
    expect(chargeCall.amount).toBe(40);
  });

  it('BIWEEKLY truncado con prorrateo desactivado cobra completo', async () => {
    const mem = getMockMembership({
        courseSeason: {
            ...getMockMembership().courseSeason,
            season: {
                startDate: new Date('2026-08-01T00:00:00.000Z'),
                endDate: new Date('2026-08-10T00:00:00.000Z') // 9 días de 14
            },
            billingConfig: { ...getMockMembership().courseSeason.billingConfig, billingFrequency: 'BIWEEKLY', prorateLastRecurringFee: false, recurringFee: 140 }
        }
    });
    membershipRepoMock.getMembershipById.mockResolvedValue(mem);
    prismaMock.charge.create.mockClear();

    await service.enrollInitialCycle(mem.id);

    const chargeCall = prismaMock.charge.create.mock.calls[0][0].data;
    expect(chargeCall.amount).toBe(140);
  });
});
