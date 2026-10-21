import { Test, TestingModule } from '@nestjs/testing';
import { PlayerMembershipsService } from './player-memberships.service';
import { PrismaService } from 'src/prisma.service';
import { MembershipChargesService } from '../membership-charges/membership-charges.service';
import { TeamSeasonCategoryStatus, StatusTeamSeason } from 'src/generated/prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('PlayerMembershipsService - create', () => {
  let service: PlayerMembershipsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerMembershipsService,
        {
          provide: PrismaService,
          useValue: {
            teamSeasonCategory: { findUnique: jest.fn() },
            paymentPlan: { findUnique: jest.fn() },
            player: { findUnique: jest.fn() },
          },
        },
        {
          provide: MembershipChargesService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PlayerMembershipsService>(PlayerMembershipsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('debe fallar si no se envía ni playerId ni personIdToCreateProfile (Ningún ID)', async () => {
    await expect(
      service.create({
        teamSeasonCategoryId: 'cat-1',
        paymentPlanId: 'plan-1',
        startedAt: new Date(),
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe fallar si se envían ambos IDs simultáneamente', async () => {
    await expect(
      service.create({
        teamSeasonCategoryId: 'cat-1',
        paymentPlanId: 'plan-1',
        playerId: 'player-1',
        personIdToCreateProfile: 'person-1',
        startedAt: new Date(),
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe rechazar la creacion si la categoria esta FINISHED', async () => {
    (prisma.teamSeasonCategory.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-1',
      status: TeamSeasonCategoryStatus.FINISHED,
      category: { minAge: 10, maxAge: 20 },
      teamSeason: { season: { startDate: new Date(), endDate: new Date() } },
    });

    await expect(
      service.create({
        teamSeasonCategoryId: 'cat-1',
        paymentPlanId: 'plan-1',
        playerId: 'player-1',
        startedAt: new Date(),
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe permitir continuar si la categoria esta ACTIVE', async () => {
    (prisma.teamSeasonCategory.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-1',
      status: TeamSeasonCategoryStatus.ACTIVE,
      category: { minAge: 10, maxAge: 20 },
      teamSeason: { season: { startDate: new Date(), endDate: new Date() } },
    });

    // Mock validatePaymentPlan to throw a specific error so we know it reached there
    (prisma.paymentPlan.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.create({
        teamSeasonCategoryId: 'cat-1',
        paymentPlanId: 'plan-1',
        playerId: 'player-1',
        startedAt: new Date(),
      } as any),
    ).rejects.toThrow('El plan de pago no fue encontrado');
  });
});

describe('PlayerMembershipsService - reenter', () => {
  let service: PlayerMembershipsService;
  let prisma: any;
  let membershipChargesService: any;

  const mockPreviousMembership = {
    id: 'prev-mem-1',
    playerId: 'player-1',
    teamSeasonId: 'ts-1',
    teamSeasonCategoryId: 'cat-1',
    status: 'WITHDRAWN',
    startedAt: new Date('2026-02-01T00:00:00.000Z'),
    endedAt: new Date('2026-04-10T00:00:00.000Z'),
    player: {
      id: 'player-1',
      isActive: true,
      person: {
        id: 'person-1',
        name: 'Mauri',
        lastName: 'Perez',
        gender: 'MALE',
        birthDate: new Date('2012-05-15T00:00:00.000Z'),
      },
    },
    teamSeason: {
      id: 'ts-1',
      season: {
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z'),
      },
    },
  };

  const mockOffering = {
    id: 'cat-1',
    teamSeasonId: 'ts-1',
    status: TeamSeasonCategoryStatus.ACTIVE,
    gender: 'MALE',
    minMembers: null,
    maxMembers: 20,
    validateAge: true,
    category: {
      minAge: 10,
      maxAge: 16,
    },
    teamSeason: {
      season: {
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z'),
      },
    },
  };

  const mockPaymentPlan = {
    id: 'plan-1',
    teamSeasonId: 'ts-1',
    name: 'Plan Mensual Estándar',
  };

  beforeEach(async () => {
    prisma = {
      playerMembership: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      teamSeasonCategory: {
        findUnique: jest.fn(),
      },
      paymentPlan: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };

    membershipChargesService = {
      generateChargesForNewMembership: jest.fn().mockResolvedValue(['charge-1']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayerMembershipsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: MembershipChargesService,
          useValue: membershipChargesService,
        },
      ],
    }).compile();

    service = module.get<PlayerMembershipsService>(PlayerMembershipsService);
  });

  it('debe fallar si la membresía anterior no existe', async () => {
    prisma.playerMembership.findUnique.mockResolvedValue(null);

    await expect(
      service.reenter({
        previousMembershipId: 'non-existent',
        teamSeasonCategoryId: 'cat-1',
        paymentPlanId: 'plan-1',
        startedAt: '2026-05-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('La membresía anterior no fue encontrada');
  });

  it('debe fallar si la membresía anterior no está en estado WITHDRAWN', async () => {
    prisma.playerMembership.findUnique.mockResolvedValue({
      ...mockPreviousMembership,
      status: 'ACTIVE',
    });

    await expect(
      service.reenter({
        previousMembershipId: 'prev-mem-1',
        teamSeasonCategoryId: 'cat-1',
        paymentPlanId: 'plan-1',
        startedAt: '2026-05-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(
      'Solo se puede registrar el reingreso para una membresía en estado RETIRADA (WITHDRAWN)',
    );
  });

  it('debe fallar si la categoría seleccionada está finalizada (FINISHED)', async () => {
    prisma.playerMembership.findUnique.mockResolvedValue(mockPreviousMembership);
    prisma.teamSeasonCategory.findUnique.mockResolvedValue({
      ...mockOffering,
      status: TeamSeasonCategoryStatus.FINISHED,
    });

    await expect(
      service.reenter({
        previousMembershipId: 'prev-mem-1',
        teamSeasonCategoryId: 'cat-1',
        paymentPlanId: 'plan-1',
        startedAt: '2026-05-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('No se puede crear una membresía en una categoría finalizada.');
  });

  it('debe bloquear el reingreso si el jugador ya tiene una membresía ACTIVE o PENDING_ACTIVE', async () => {
    prisma.playerMembership.findUnique.mockResolvedValue(mockPreviousMembership);
    prisma.teamSeasonCategory.findUnique.mockResolvedValue(mockOffering);
    prisma.paymentPlan.findUnique.mockResolvedValue(mockPaymentPlan);
    prisma.playerMembership.count.mockResolvedValue(5); // under maxMembers
    prisma.playerMembership.findMany.mockResolvedValue([
      { id: 'active-mem-99', status: 'ACTIVE' },
    ]);

    await expect(
      service.reenter({
        previousMembershipId: 'prev-mem-1',
        teamSeasonCategoryId: 'cat-1',
        paymentPlanId: 'plan-1',
        startedAt: '2026-05-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('El jugador ya cuenta con una membresía vigente (ACTIVE) en esta temporada');
  });

  it('debe bloquear el reingreso y orientar a Secretaría si el jugador tiene una membresía SUSPENDED', async () => {
    prisma.playerMembership.findUnique.mockResolvedValue(mockPreviousMembership);
    prisma.teamSeasonCategory.findUnique.mockResolvedValue(mockOffering);
    prisma.paymentPlan.findUnique.mockResolvedValue(mockPaymentPlan);
    prisma.playerMembership.count.mockResolvedValue(5);
    prisma.playerMembership.findMany.mockResolvedValue([
      { id: 'susp-mem-99', status: 'SUSPENDED' },
    ]);

    await expect(
      service.reenter({
        previousMembershipId: 'prev-mem-1',
        teamSeasonCategoryId: 'cat-1',
        paymentPlanId: 'plan-1',
        startedAt: '2026-05-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('orientar a Secretaría al flujo de levantamiento de suspensión');
  });

  it('debe bloquear el reingreso si no hay cupos disponibles en la categoría', async () => {
    prisma.playerMembership.findUnique.mockResolvedValue(mockPreviousMembership);
    prisma.teamSeasonCategory.findUnique.mockResolvedValue(mockOffering);
    prisma.paymentPlan.findUnique.mockResolvedValue(mockPaymentPlan);
    prisma.playerMembership.count.mockResolvedValue(20); // maxMembers reached

    await expect(
      service.reenter({
        previousMembershipId: 'prev-mem-1',
        teamSeasonCategoryId: 'cat-1',
        paymentPlanId: 'plan-1',
        startedAt: '2026-05-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('La categoría seleccionada ya alcanzó el número máximo de miembros permitidos');
  });

  it('debe registrar exitosamente el reingreso creando nueva membresía ACTIVE y respetando opciones de matrícula y cuota', async () => {
    prisma.playerMembership.findUnique.mockResolvedValue(mockPreviousMembership);
    prisma.teamSeasonCategory.findUnique.mockResolvedValue(mockOffering);
    prisma.paymentPlan.findUnique.mockResolvedValue(mockPaymentPlan);
    prisma.playerMembership.count.mockResolvedValue(10); // cupos disponibles
    prisma.playerMembership.findMany.mockResolvedValue([]); // sin duplicados

    const mockCreatedMembership = {
      id: 'new-membership-999',
      playerId: 'player-1',
      teamSeasonId: 'ts-1',
      teamSeasonCategoryId: 'cat-1',
      paymentPlanId: 'plan-1',
      startedAt: new Date('2026-05-01T00:00:00.000Z'),
      status: 'ACTIVE',
      membershipCharges: [],
    };
    prisma.playerMembership.create.mockResolvedValue(mockCreatedMembership);

    const result = await service.reenter({
      previousMembershipId: 'prev-mem-1',
      teamSeasonCategoryId: 'cat-1',
      paymentPlanId: 'plan-1',
      startedAt: '2026-05-01T00:00:00.000Z',
      chargeRegistration: false,
      skipCurrentMonthRecurringFee: true,
      notes: 'Reingreso con matrícula exonerada y cuota actual omitida',
    });

    // 1. Lock pesimista adquirido
    expect(prisma.$queryRaw).toHaveBeenCalled();

    // 2. Nueva membresía creada con ID independiente y estado ACTIVE
    expect(prisma.playerMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          playerId: 'player-1',
          teamSeasonId: 'ts-1',
          teamSeasonCategoryId: 'cat-1',
          paymentPlanId: 'plan-1',
          status: 'ACTIVE',
        }),
      }),
    );

    // 3. Generación de cargos invocada con opciones correctas
    expect(membershipChargesService.generateChargesForNewMembership).toHaveBeenCalledWith(
      'new-membership-999',
      {
        chargeRegistration: false,
        skipCurrentMonthRecurringFee: true,
      },
      prisma,
    );

    expect(result.message).toBe('Reingreso registrado exitosamente');
    expect(result.data.id).toBe('new-membership-999');
    expect(result.generatedChargeIds).toEqual(['charge-1']);
  });
});

