import { Test, TestingModule } from '@nestjs/testing';
import { AccountingAnalyticsService } from './accounting-analytics.service';
import { PrismaService } from 'src/prisma.service';
import { StatusCharge } from 'src/generated/prisma/client';

describe('AccountingAnalyticsService', () => {
  let service: AccountingAnalyticsService;
  let prisma: PrismaService;

  const mockPrisma = {
    charge: {
      aggregate: jest.fn(),
    },
    financialAccount: {
      findMany: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AccountingAnalyticsService>(AccountingAnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getReceivableMetrics', () => {
    it('should aggregate account, membership, and student charges and sum them correctly', async () => {
      mockPrisma.charge.aggregate
        .mockResolvedValueOnce({ _sum: { pendingAmount: 150.5 } }) // accountReceivables
        .mockResolvedValueOnce({ _sum: { pendingAmount: 300.0 } }) // membershipReceivables
        .mockResolvedValueOnce({ _sum: { pendingAmount: 450.5 } }); // studentReceivables

      const result = await (service as any).getReceivableMetrics();

      expect(mockPrisma.charge.aggregate).toHaveBeenCalledTimes(3);

      // Verify the 3 calls
      expect(mockPrisma.charge.aggregate).toHaveBeenNthCalledWith(1, {
        where: {
          direction: 'RECEIVABLE',
          status: { in: [StatusCharge.PENDING, StatusCharge.PARTIAL] },
          accountCharge: { isNot: null },
        },
        _sum: { pendingAmount: true },
      });

      expect(mockPrisma.charge.aggregate).toHaveBeenNthCalledWith(2, {
        where: {
          direction: 'RECEIVABLE',
          status: { in: [StatusCharge.PENDING, StatusCharge.PARTIAL] },
          membershipCharges: { some: {} },
        },
        _sum: { pendingAmount: true },
      });

      expect(mockPrisma.charge.aggregate).toHaveBeenNthCalledWith(3, {
        where: {
          direction: 'RECEIVABLE',
          status: { in: [StatusCharge.PENDING, StatusCharge.PARTIAL] },
          studentCharges: { some: {} },
        },
        _sum: { pendingAmount: true },
      });

      expect(result).toEqual({
        totalAccountReceivables: 150.5,
        totalMembershipReceivables: 300.0,
        totalStudentReceivables: 450.5,
        totalReceivables: 901.0, // 150.5 + 300.0 + 450.5
      });
    });

    it('should handle null sums as 0', async () => {
      mockPrisma.charge.aggregate
        .mockResolvedValueOnce({ _sum: { pendingAmount: null } })
        .mockResolvedValueOnce({ _sum: { pendingAmount: null } })
        .mockResolvedValueOnce({ _sum: { pendingAmount: null } });

      const result = await (service as any).getReceivableMetrics();

      expect(result).toEqual({
        totalAccountReceivables: 0,
        totalMembershipReceivables: 0,
        totalStudentReceivables: 0,
        totalReceivables: 0,
      });
    });
  });
});
