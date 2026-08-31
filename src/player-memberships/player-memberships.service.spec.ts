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
