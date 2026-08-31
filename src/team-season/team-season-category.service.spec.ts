import { Test, TestingModule } from '@nestjs/testing';
import { TeamSeasonCategoryService } from './team-season-category.service';
import { PrismaService } from 'src/prisma.service';
import { PlayerMembershipStatus, StatusCharge, TeamSeasonCategoryStatus } from 'src/generated/prisma/client';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('TeamSeasonCategoryService - finishEarly', () => {
  let service: TeamSeasonCategoryService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamSeasonCategoryService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
            teamSeasonCategory: { updateMany: jest.fn(), findUnique: jest.fn() },
            playerMembership: { findMany: jest.fn(), updateMany: jest.fn() },
            playerMembershipHistory: { createMany: jest.fn() },
            membershipCharge: { findMany: jest.fn() },
            charge: { updateMany: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<TeamSeasonCategoryService>(TeamSeasonCategoryService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Caso 1: ACTIVE -> FINISHED, Caso 4-6: ACTIVE/PENDING/SUSPENDED -> FINISHED
  it('should successfully finish category and affected memberships', async () => {
    (prisma.teamSeasonCategory.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.teamSeasonCategory.findUnique as jest.Mock).mockResolvedValue({ id: 'cat-1', status: TeamSeasonCategoryStatus.FINISHED });
    
    // Simular que retorna 3 membresias de diferentes estados activos
    (prisma.playerMembership.findMany as jest.Mock).mockResolvedValue([
      { id: 'm1', status: PlayerMembershipStatus.ACTIVE },
      { id: 'm2', status: PlayerMembershipStatus.PENDING_ACTIVE },
      { id: 'm3', status: PlayerMembershipStatus.SUSPENDED },
    ]);
    
    (prisma.membershipCharge.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.finishEarly('cat-1', { notes: 'test' });
    
    expect(result.message).toContain('éxito'); // Success message
    
    // Verify membership updates
    expect(prisma.playerMembership.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['m1', 'm2', 'm3'] } },
      data: expect.objectContaining({
        status: PlayerMembershipStatus.FINISHED,
        nextRecurringChargeGenerationDate: null,
        endedAt: expect.any(Date),
      }),
    });

    // Verify history creation
    expect(prisma.playerMembershipHistory.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ previousStatus: PlayerMembershipStatus.ACTIVE, newStatus: PlayerMembershipStatus.FINISHED }),
        expect.objectContaining({ previousStatus: PlayerMembershipStatus.PENDING_ACTIVE, newStatus: PlayerMembershipStatus.FINISHED }),
        expect.objectContaining({ previousStatus: PlayerMembershipStatus.SUSPENDED, newStatus: PlayerMembershipStatus.FINISHED }),
      ]),
    });
  });

  // Caso 2: FINISHED -> ConflictException
  it('should throw ConflictException if category is already finished', async () => {
    (prisma.teamSeasonCategory.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.teamSeasonCategory.findUnique as jest.Mock).mockResolvedValue({ id: 'cat-1', status: TeamSeasonCategoryStatus.FINISHED });
    
    await expect(service.finishEarly('cat-1', {})).rejects.toThrow(ConflictException);
  });

  // Caso 3: Inexistente -> NotFoundException
  it('should throw NotFoundException if category does not exist', async () => {
    (prisma.teamSeasonCategory.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.teamSeasonCategory.findUnique as jest.Mock).mockResolvedValue(null);
    
    await expect(service.finishEarly('cat-no', {})).rejects.toThrow(NotFoundException);
  });

  // Caso 24 (CRITICO): dueDate > endedAt pero billingMonth = mes de cierre (NO DEBE CANCELAR)
  it('should NOT cancel charge if billingMonth matches endedAt month despite future dueDate', async () => {
    (prisma.teamSeasonCategory.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.teamSeasonCategory.findUnique as jest.Mock).mockResolvedValue({ id: 'cat-1' });
    (prisma.playerMembership.findMany as jest.Mock).mockResolvedValue([{ id: 'm1', status: PlayerMembershipStatus.ACTIVE }]);
    
    // Cierre simulado hoy
    const endedAt = new Date();
    const endedAtYear = endedAt.getUTCFullYear();
    const endedAtMonth = endedAt.getUTCMonth() + 1;

    // Cargo cuyo dueDate es 5 días después, pero pertenece a este mes
    const futureDueDate = new Date(endedAt.getTime());
    futureDueDate.setDate(futureDueDate.getDate() + 5);

    (prisma.membershipCharge.findMany as jest.Mock).mockResolvedValue([
      {
        chargeId: 'charge-1',
        billingYear: endedAtYear,
        billingMonth: endedAtMonth,
        charge: { dueDate: futureDueDate, status: StatusCharge.PENDING },
      },
    ]);

    await service.finishEarly('cat-1', {});

    // No debe haberse llamado a cancelar cargos, o si se llamA3 fue con arreglo vacA-o
    expect(prisma.charge.updateMany).not.toHaveBeenCalled();
  });

  // Caso 11 y 12: Cancelar cargos de meses/años futuros
  it('should cancel charges for future billing periods', async () => {
    (prisma.teamSeasonCategory.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.teamSeasonCategory.findUnique as jest.Mock).mockResolvedValue({ id: 'cat-1' });
    (prisma.playerMembership.findMany as jest.Mock).mockResolvedValue([{ id: 'm1', status: PlayerMembershipStatus.ACTIVE }]);
    
    const endedAt = new Date();
    const endedAtYear = endedAt.getUTCFullYear();
    const endedAtMonth = endedAt.getUTCMonth() + 1;

    (prisma.membershipCharge.findMany as jest.Mock).mockResolvedValue([
      { // Futuro por año
        chargeId: 'charge-next-year',
        billingYear: endedAtYear + 1,
        billingMonth: 1,
        charge: { dueDate: new Date(), status: StatusCharge.PENDING },
      },
      { // Futuro por mes
        chargeId: 'charge-next-month',
        billingYear: endedAtYear,
        billingMonth: endedAtMonth + 1,
        charge: { dueDate: new Date(), status: StatusCharge.PENDING },
      },
    ]);

    await service.finishEarly('cat-1', {});

    expect(prisma.charge.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['charge-next-year', 'charge-next-month'] } },
      data: { status: StatusCharge.CANCELLED },
    });
  });
});
