import { Test, TestingModule } from '@nestjs/testing';
import { TeamSeasonService } from './team-season.service';
import { PrismaService } from 'src/prisma.service';
import { MembershipChargesService } from '../membership-charges/membership-charges.service';
import { StatusTeamSeason, TeamSeasonCategoryStatus } from 'src/generated/prisma/client';

describe('TeamSeasonService - findPublic', () => {
  let service: TeamSeasonService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamSeasonService,
        {
          provide: PrismaService,
          useValue: {
            teamSeason: { findMany: jest.fn() },
          },
        },
        {
          provide: MembershipChargesService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<TeamSeasonService>(TeamSeasonService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('debe filtrar las categorias con estado ACTIVE y activas (isActive) en modo NO historico', async () => {
    (prisma.teamSeason.findMany as jest.Mock).mockResolvedValue([]);

    await service.findPublic(false);

    expect(prisma.teamSeason.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          categories: expect.objectContaining({
            where: {
              isActive: true,
              status: TeamSeasonCategoryStatus.ACTIVE,
            },
          }),
        }),
      }),
    );
  });

  it('no debe filtrar por status en modo historico', async () => {
    (prisma.teamSeason.findMany as jest.Mock).mockResolvedValue([]);

    await service.findPublic(true);

    expect(prisma.teamSeason.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          categories: expect.objectContaining({
            where: {
              isActive: true,
            },
          }),
        }),
      }),
    );
  });
});
