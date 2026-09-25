import { Test, TestingModule } from '@nestjs/testing';
import { LateFeeRepository } from './late-fee.repository';
import { PrismaService } from 'src/prisma.service';
import { PlayerMembershipStatus, TypeMembershipCharge, StatusCharge } from 'src/generated/prisma/client';

describe('LateFeeRepository', () => {
  let repository: LateFeeRepository;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LateFeeRepository,
        {
          provide: PrismaService,
          useValue: {
            charge: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    repository = module.get<LateFeeRepository>(LateFeeRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('findOverdueCharges', () => {
    it('should include PENDING_ACTIVE, ACTIVE, and SUSPENDED in status filter', async () => {
      const evaluationDate = new Date();
      await repository.findOverdueCharges(evaluationDate);

      expect(prismaService.charge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            membershipCharges: expect.objectContaining({
              some: expect.objectContaining({
                playerMembership: expect.objectContaining({
                  status: {
                    in: expect.arrayContaining([
                      PlayerMembershipStatus.ACTIVE,
                      PlayerMembershipStatus.PENDING_ACTIVE,
                      PlayerMembershipStatus.SUSPENDED,
                    ]),
                  },
                }),
              }),
            }),
          }),
        }),
      );
      
      // Verification of strictly ONLY those 3
      const callArgs = (prismaService.charge.findMany as jest.Mock).mock.calls[0][0];
      const statuses = callArgs.where.membershipCharges.some.playerMembership.status.in;
      expect(statuses).toHaveLength(3);
    });

    it('should only include RECURRING_FEE and SEASON_FEE, excluding REGISTRATION', async () => {
      const evaluationDate = new Date();
      await repository.findOverdueCharges(evaluationDate);

      const callArgs = (prismaService.charge.findMany as jest.Mock).mock.calls[0][0];
      const chargeTypes = callArgs.where.membershipCharges.some.type.in;
      
      expect(chargeTypes).toContain(TypeMembershipCharge.RECURRING_FEE);
      expect(chargeTypes).toContain(TypeMembershipCharge.SEASON_FEE);
      expect(chargeTypes).not.toContain(TypeMembershipCharge.REGISTRATION);
      expect(chargeTypes).toHaveLength(2);
    });
  });
});
