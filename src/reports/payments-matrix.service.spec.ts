import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsMatrixService } from './payments-matrix.service';
import { PrismaService } from 'src/prisma.service';
import { PlayerMembershipStatus, TypeMembershipCharge } from 'src/generated/prisma/client';

describe('PaymentsMatrixService', () => {
  let service: PaymentsMatrixService;
  let prisma: {
    teamSeason: { findFirst: jest.Mock };
    courseSeasonShift: { findFirst: jest.Mock };
    cycleEnrollment: { findMany: jest.Mock };
  };

  const mockBaseTeamSeason = {
    id: 'ts-1',
    team: {
      name: 'Equipo Sub-15',
      club: { institutionId: 'inst-1' },
    },
    season: {
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T23:59:59.000Z'),
    },
    billingConfig: {
      billingFrequency: 'MONTHLY',
    },
    categories: [
      { id: 'cat-1', category: { name: 'U-15 Varones' } },
    ],
  };

  beforeEach(async () => {
    prisma = {
      teamSeason: { findFirst: jest.fn() },
      courseSeasonShift: { findFirst: jest.fn() },
      cycleEnrollment: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsMatrixService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<PaymentsMatrixService>(PaymentsMatrixService);
  });

  describe('getTeamSeasonMatrix', () => {
    it('should exclude WITHDRAWN memberships by default in operational report', async () => {
      prisma.teamSeason.findFirst.mockResolvedValue({
        ...mockBaseTeamSeason,
        playerMemberships: [
          {
            id: 'mem-1',
            status: PlayerMembershipStatus.ACTIVE,
            notes: null,
            histories: [],
            player: {
              id: 'player-1',
              person: { name: 'Juan', lastName: 'Perez' },
            },
            membershipCharges: [],
          },
          {
            id: 'mem-2',
            status: PlayerMembershipStatus.SUSPENDED,
            notes: 'Falta de pago',
            histories: [
              { newStatus: PlayerMembershipStatus.SUSPENDED, reason: 'Falta de pago' },
            ],
            player: {
              id: 'player-2',
              person: { name: 'Carlos', lastName: 'Lopez' },
            },
            membershipCharges: [],
          },
        ],
      });

      const result = await service.getTeamSeasonMatrix('inst-1', 'ts-1', 'cat-1', false);

      // Verify Prisma query filtered out WITHDRAWN
      expect(prisma.teamSeason.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'ts-1',
            team: { club: { institutionId: 'inst-1' } },
          },
          include: expect.objectContaining({
            playerMemberships: expect.objectContaining({
              where: {
                teamSeasonCategoryId: 'cat-1',
                status: { not: PlayerMembershipStatus.WITHDRAWN },
              },
            }),
          }),
        }),
      );

      expect(result.students).toHaveLength(2);
      expect(result.students[0].name).toBe('Lopez Carlos');
      expect(result.students[0].status).toBe(PlayerMembershipStatus.SUSPENDED);
      expect(result.students[0].suspensionReason).toBe('Falta de pago');

      expect(result.students[1].name).toBe('Perez Juan');
      expect(result.students[1].status).toBe(PlayerMembershipStatus.ACTIVE);
      expect(result.students[1].suspensionReason).toBeUndefined();
    });

    it('should allow including WITHDRAWN memberships when includeWithdrawn is true', async () => {
      prisma.teamSeason.findFirst.mockResolvedValue({
        ...mockBaseTeamSeason,
        playerMemberships: [
          {
            id: 'mem-3',
            status: PlayerMembershipStatus.WITHDRAWN,
            notes: 'Retirado por viaje',
            histories: [],
            player: {
              id: 'player-3',
              person: { name: 'Mario', lastName: 'Gomez' },
            },
            membershipCharges: [],
          },
        ],
      });

      const result = await service.getTeamSeasonMatrix('inst-1', 'ts-1', 'cat-1', true);

      // Verify Prisma query did NOT filter out WITHDRAWN
      expect(prisma.teamSeason.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            playerMemberships: expect.objectContaining({
              where: {
                teamSeasonCategoryId: 'cat-1',
              },
            }),
          }),
        }),
      );

      expect(result.students).toHaveLength(1);
      expect(result.students[0].name).toBe('Gomez Mario');
      expect(result.students[0].status).toBe(PlayerMembershipStatus.WITHDRAWN);
    });

    it('should correctly format suspension reason combining history reason and notes when they differ', async () => {
      prisma.teamSeason.findFirst.mockResolvedValue({
        ...mockBaseTeamSeason,
        playerMemberships: [
          {
            id: 'mem-diff',
            status: PlayerMembershipStatus.SUSPENDED,
            notes: 'Observación: falta acumulada',
            histories: [
              {
                newStatus: PlayerMembershipStatus.SUSPENDED,
                reason: 'Suspensión disciplinaria',
              },
            ],
            player: {
              id: 'player-diff',
              person: { name: 'Ana', lastName: 'Torres' },
            },
            membershipCharges: [],
          },
        ],
      });

      const result = await service.getTeamSeasonMatrix('inst-1', 'ts-1', 'cat-1');

      expect(result.students[0].suspensionReason).toBe('Suspensión disciplinaria (Observación: falta acumulada)');
    });

    it('should show "Motivo no registrado" when a SUSPENDED membership has neither history reason nor notes', async () => {
      prisma.teamSeason.findFirst.mockResolvedValue({
        ...mockBaseTeamSeason,
        playerMemberships: [
          {
            id: 'mem-empty',
            status: PlayerMembershipStatus.SUSPENDED,
            notes: null,
            histories: [],
            player: {
              id: 'player-empty',
              person: { name: 'Pedro', lastName: 'Ramirez' },
            },
            membershipCharges: [],
          },
        ],
      });

      const result = await service.getTeamSeasonMatrix('inst-1', 'ts-1', 'cat-1');

      expect(result.students[0].status).toBe(PlayerMembershipStatus.SUSPENDED);
      expect(result.students[0].suspensionReason).toBe('Motivo no registrado');
    });

    it('should preserve all payments and charges for suspended memberships without modification', async () => {
      prisma.teamSeason.findFirst.mockResolvedValue({
        ...mockBaseTeamSeason,
        playerMemberships: [
          {
            id: 'mem-susp-paid',
            status: PlayerMembershipStatus.SUSPENDED,
            notes: 'Pausa médica',
            histories: [{ newStatus: PlayerMembershipStatus.SUSPENDED, reason: 'Pausa médica' }],
            player: {
              id: 'player-susp',
              person: { name: 'Luis', lastName: 'Mendoza' },
            },
            membershipCharges: [
              {
                type: TypeMembershipCharge.REGISTRATION,
                billingYear: 2026,
                billingMonth: 1,
                charge: {
                  payments: [
                    {
                      amount: '100',
                      paymentDate: new Date('2026-01-05T10:00:00.000Z'),
                      receiptSeries: 'REC',
                      receiptNumber: 12,
                    },
                  ],
                },
              },
              {
                type: TypeMembershipCharge.RECURRING_FEE,
                billingYear: 2026,
                billingMonth: 1,
                charge: {
                  payments: [
                    {
                      amount: '150',
                      paymentDate: new Date('2026-01-10T10:00:00.000Z'),
                      receiptSeries: 'REC',
                      receiptNumber: 13,
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const result = await service.getTeamSeasonMatrix('inst-1', 'ts-1', 'cat-1');

      expect(result.students).toHaveLength(1);
      const student = result.students[0];
      expect(student.status).toBe(PlayerMembershipStatus.SUSPENDED);
      expect(student.registration?.totalPaid).toBe(100);
      expect(student.paymentsByPeriod['2026-1']?.totalPaid).toBe(150);
    });

    it('should deterministically prioritize latest membership status (ACTIVE) and consolidate payments from multiple memberships of the same player', async () => {
      prisma.teamSeason.findFirst.mockResolvedValue({
        ...mockBaseTeamSeason,
        playerMemberships: [
          // Order in array: historical WITHDRAWN membership first (to test order independence)
          {
            id: 'mem-old-withdrawn',
            status: PlayerMembershipStatus.WITHDRAWN,
            startedAt: new Date('2026-01-01T00:00:00.000Z'),
            createdAt: new Date('2026-01-01T10:00:00.000Z'),
            notes: 'Baja anterior',
            histories: [],
            player: {
              id: 'player-reentry',
              person: { name: 'Lucas', lastName: 'Silva' },
            },
            membershipCharges: [
              {
                type: TypeMembershipCharge.REGISTRATION,
                billingYear: 2026,
                billingMonth: 1,
                charge: {
                  payments: [
                    {
                      amount: '100',
                      paymentDate: new Date('2026-01-02T10:00:00.000Z'),
                      receiptSeries: 'REC',
                      receiptNumber: 101,
                    },
                  ],
                },
              },
              {
                type: TypeMembershipCharge.RECURRING_FEE,
                billingYear: 2026,
                billingMonth: 1,
                charge: {
                  payments: [
                    {
                      amount: '150',
                      paymentDate: new Date('2026-01-05T10:00:00.000Z'),
                      receiptSeries: 'REC',
                      receiptNumber: 102,
                    },
                  ],
                },
              },
            ],
          },
          // New ACTIVE membership after re-entry
          {
            id: 'mem-new-active',
            status: PlayerMembershipStatus.ACTIVE,
            startedAt: new Date('2026-03-01T00:00:00.000Z'),
            createdAt: new Date('2026-03-01T10:00:00.000Z'),
            notes: 'Reingreso',
            histories: [],
            player: {
              id: 'player-reentry',
              person: { name: 'Lucas', lastName: 'Silva' },
            },
            membershipCharges: [
              {
                type: TypeMembershipCharge.RECURRING_FEE,
                billingYear: 2026,
                billingMonth: 3,
                charge: {
                  payments: [
                    {
                      amount: '150',
                      paymentDate: new Date('2026-03-05T10:00:00.000Z'),
                      receiptSeries: 'REC',
                      receiptNumber: 201,
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const result = await service.getTeamSeasonMatrix('inst-1', 'ts-1', 'cat-1', true);

      // Must be a SINGLE consolidated row for the player (no duplicate rows)
      expect(result.students).toHaveLength(1);
      const student = result.students[0];
      expect(student.name).toBe('Silva Lucas');
      // Status must be deterministically ACTIVE (from the newer membership)
      expect(student.status).toBe(PlayerMembershipStatus.ACTIVE);
      // Historical registration fee preserved
      expect(student.registration?.totalPaid).toBe(100);
      // Both period 1 and period 3 payments consolidated
      expect(student.paymentsByPeriod['2026-1']?.totalPaid).toBe(150);
      expect(student.paymentsByPeriod['2026-3']?.totalPaid).toBe(150);
    });
  });
});
