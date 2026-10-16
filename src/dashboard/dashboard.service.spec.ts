import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from 'src/prisma.service';
import {
  TransactionType,
  StudentMembershipStatus,
  PlayerMembershipStatus,
} from 'src/generated/prisma/client';

describe('DashboardService (Selective Unit Tests)', () => {
  let service: DashboardService;

  const mockPrisma = {
    financialAccount: { findMany: jest.fn() },
    transaction: { findMany: jest.fn() },
    charge: { aggregate: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    studentMembership: { findMany: jest.fn() },
    playerMembership: { findMany: jest.fn() },
    courseSeason: { findMany: jest.fn() },
    cycleEnrollment: { groupBy: jest.fn(), count: jest.fn() },
    auditLog: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Financial Metrics (Canonical Rules & DB Aggregation)', () => {
    it('should aggregate financial flow at the database level via SQL returning grouped points', async () => {
      const periodStart = new Date('2026-10-01T00:00:00Z');
      const periodEnd = new Date('2026-10-31T23:59:59Z');

      // Database returns aggregated rows, 0 unaggregated transactions loaded into Node
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { date_bucket: '2026-10-05', type: TransactionType.INCOME, total: '1000.00' },
        { date_bucket: '2026-10-10', type: TransactionType.EXPENSE, total: '300.00' },
      ]);

      const flow = await service.getFinancialFlowMetrics(periodStart, periodEnd);

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(flow.totalIncome).toBe(1000);
      expect(flow.totalExpense).toBe(300);
      expect(flow.netResult).toBe(700);
      expect(flow.series.length).toBeGreaterThan(0);
    });

    it('should assign a near-midnight transaction (15 Oct 23:30 local / 16 Oct 03:30Z) to 15 Oct bucket respecting appTimezone', async () => {
      const periodStart = new Date('2026-10-15T04:00:00.000Z');
      const periodEnd = new Date('2026-10-16T03:59:59.999Z');

      // In PostgreSQL: TO_CHAR((transaction_date AT TIME ZONE 'UTC') AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')
      // converts 2026-10-16 03:30Z into '2026-10-15'
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { date_bucket: '2026-10-15', type: TransactionType.INCOME, total: '500.00' },
      ]);

      const flow = await service.getFinancialFlowMetrics(periodStart, periodEnd);

      expect(flow.totalIncome).toBe(500);
      const targetPoint = flow.series.find((p) => p.date === '2026-10-15');
      expect(targetPoint).toBeDefined();
      expect(targetPoint?.income).toBe(500);

      // Verify it did not bleed into 16 Oct
      const nextDayPoint = flow.series.find((p) => p.date === '2026-10-16');
      if (nextDayPoint) {
        expect(nextDayPoint.income).toBe(0);
      }
    });

    it('should use cachedBalance from active financial accounts for liquidity', async () => {
      mockPrisma.financialAccount.findMany.mockResolvedValueOnce([
        { id: 'acc-1', name: 'Caja Central', type: 'CASH', currency: 'BOB', cachedBalance: 2500 },
        { id: 'acc-2', name: 'Banco FIE', type: 'BANK', currency: 'BOB', cachedBalance: 7500 },
      ]);

      const liquidity = await service.getLiquidityMetrics();

      expect(liquidity.total).toBe(10000);
      expect(liquidity.currency).toBe('BOB');
      expect(liquidity.activeAccountsCount).toBe(2);
      expect(liquidity.accounts[0].percentage).toBe(25);
      expect(liquidity.accounts[1].percentage).toBe(75);
    });

    it('should aggregate receivables directly in PostgreSQL without loading rows into memory', async () => {
      mockPrisma.charge.aggregate
        .mockResolvedValueOnce({
          _sum: { pendingAmount: 50000 },
          _count: { id: 120 },
        })
        .mockResolvedValueOnce({
          _sum: { pendingAmount: 20000 },
          _count: { id: 45 },
        });

      const receivables = await service.getReceivablesMetrics();

      expect(mockPrisma.charge.aggregate).toHaveBeenCalledTimes(2);
      expect(receivables.totalPending).toBe(50000);
      expect(receivables.pendingChargesCount).toBe(120);
      expect(receivables.overdueAmount).toBe(20000);
      expect(receivables.overdueChargesCount).toBe(45);
      expect(receivables.currentAmount).toBe(30000);
      expect(receivables.overduePercentage).toBe(40);
    });
  });

  describe('2. Community Semantics (Unique People & Membership Deduplication)', () => {
    it('should count person with dual memberships once in uniqueActivePeople, but separately in total memberships', async () => {
      const dualPersonId = 'person-dual-123';
      const studentOnlyPersonId = 'person-student-456';
      const playerOnlyPersonId = 'person-player-789';

      mockPrisma.studentMembership.findMany.mockResolvedValueOnce([
        { student: { personId: dualPersonId } },
        { student: { personId: studentOnlyPersonId } },
      ]);

      mockPrisma.playerMembership.findMany.mockResolvedValueOnce([
        { player: { personId: dualPersonId } },
        { player: { personId: playerOnlyPersonId } },
      ]);

      const community = await service.getCommunityMetrics();

      expect(community.activeStudents).toBe(2);
      expect(community.activePlayers).toBe(2);
      expect(community.totalActiveMemberships).toBe(4);
      expect(community.uniqueActivePeople).toBe(3); // 3 unique persons
      expect(community.dualAthletesCount).toBe(1);
    });
  });

  describe('3. Course Occupancy (Canonical Capacity Condition)', () => {
    it('should query cycleEnrollment groupBy using canonical buildValidOccupancyCondition', async () => {
      mockPrisma.courseSeason.findMany.mockResolvedValueOnce([
        {
          id: 'cs-1',
          course: {
            name: 'Básquet Formativo',
            school: { discipline: { name: 'Básquetbol' } },
          },
          shifts: [
            { id: 'shift-1', maxMembers: 50, shift: { name: 'Tarde' } },
          ],
        },
      ]);

      mockPrisma.cycleEnrollment.groupBy.mockImplementation(async (args) => {
        expect(args.where.OR).toBeDefined();
        return [
          { courseSeasonShiftId: 'shift-1', _count: { _all: 48 } },
        ];
      });

      const occupancy = await service.getCoursesOccupancyMetrics();

      expect(occupancy.totalCapacity).toBe(50);
      expect(occupancy.totalOccupied).toBe(48);
      expect(occupancy.globalRate).toBe(96);
      expect(occupancy.topOccupiedShifts[0].occupied).toBe(48);
      expect(occupancy.topOccupiedShifts[0].available).toBe(2);
      expect(occupancy.topOccupiedShifts[0].rate).toBe(96);
    });
  });

  describe('4. Activity Feed (Security & Null User Representation)', () => {
    it('should map business events, enforce limit, NEVER return oldValues/newValues, and return strictly user: null for automated events', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValueOnce([
        {
          id: 'log-1',
          entityName: 'Payment',
          entityId: 'pay-123',
          action: 'CREATE',
          createdAt: new Date('2026-10-15T10:00:00Z'),
          oldValues: { sensitiveData: 'should_not_leak' },
          newValues: { secret: 'do_not_expose' },
          user: {
            id: 'user-1',
            email: 'admin@gestioncan.com',
            person: { name: 'Ariel', lastName: 'Admin' },
          },
          messageParams: null,
        },
        {
          id: 'log-2',
          entityName: 'InternalTransfer',
          entityId: 'tx-456',
          action: 'CREATE',
          createdAt: new Date('2026-10-15T09:30:00Z'),
          oldValues: null,
          newValues: null,
          user: null, // Automated event
          messageParams: null,
        },
      ]);

      const result = await service.getActivity({ limit: 10 });

      expect(result.items.length).toBe(2);

      // Verify mapping
      expect(result.items[0].actionType).toBe('PAYMENT');
      expect(result.items[0].user?.displayName).toBe('Ariel Admin');
      expect((result.items[0] as any).oldValues).toBeUndefined();
      expect((result.items[0] as any).newValues).toBeUndefined();

      // Automated event must have strictly user === null, no fake system user
      expect(result.items[1].actionType).toBe('INTERNAL_TRANSFER');
      expect(result.items[1].user).toBeNull();
    });
  });

  describe('5. RBAC & Section Nullability', () => {
    it('should omit financial section when user lacks READ_FINANCIAL_ACCOUNTS and flow permissions', async () => {
      const userPermissions = ['READ_STUDENT_MEMBERSHIPS'];

      mockPrisma.studentMembership.findMany.mockResolvedValueOnce([]);
      mockPrisma.playerMembership.findMany.mockResolvedValueOnce([]);

      const summary = await service.getSummary({}, userPermissions);

      // Financial sections are undefined
      expect(summary.liquidity).toBeUndefined();
      expect(summary.financialFlow).toBeUndefined();
      expect(summary.receivables).toBeUndefined();
      expect(summary.coursesOccupancy).toBeUndefined();

      // Authorized community section is defined even if zero data
      expect(summary.community).toBeDefined();
      expect(summary.community?.totalActiveMemberships).toBe(0);
      expect(summary.community?.uniqueActivePeople).toBe(0);
    });

    it('should distinguish authorized zero values from unauthorized absent sections', async () => {
      const userPermissions = ['READ_FINANCIAL_ACCOUNTS'];

      mockPrisma.financialAccount.findMany.mockResolvedValueOnce([]);

      const summary = await service.getSummary({}, userPermissions);

      expect(summary.liquidity).toBeDefined();
      expect(summary.liquidity?.total).toBe(0);
      expect(summary.liquidity?.accounts).toEqual([]);

      // Community is unauthorized -> absent
      expect(summary.community).toBeUndefined();
    });
  });
});
