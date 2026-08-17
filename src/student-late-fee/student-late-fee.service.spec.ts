import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma.service';
import { StatusCharge, TypeMembershipCharge } from 'src/generated/prisma/client';
import { StudentLateFeeService } from './student-late-fee.service';
import { StudentLateFeeRepository } from './repositories/student-late-fee.repository';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('StudentLateFeeService - On Demand', () => {
  let service: StudentLateFeeService;
  let lateFeeRepo: jest.Mocked<StudentLateFeeRepository>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockLateFeeRepo = {
      findChargeForLateFee: jest.fn(),
      findPendingLateFeeCharge: jest.fn(),
      createLateFeeCharge: jest.fn(),
    };

    const mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockPrisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentLateFeeService,
        {
          provide: StudentLateFeeRepository,
          useValue: mockLateFeeRepo,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<StudentLateFeeService>(StudentLateFeeService);
    lateFeeRepo = module.get(StudentLateFeeRepository);
    prisma = module.get(PrismaService);
  });

  const baseDate = new Date('2026-08-10T00:00:00.000Z');

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(baseDate);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('previewLateFee', () => {
    it('Lanza NotFound si el cargo no existe', async () => {
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(null);
      await expect(service.previewLateFee('123')).rejects.toThrow(NotFoundException);
    });

    it('Lanza BadRequest si el cargo esta PAID', async () => {
      lateFeeRepo.findChargeForLateFee.mockResolvedValue({
        id: '123',
        status: StatusCharge.PAID,
        studentCharges: [],
      } as any);
      await expect(service.previewLateFee('123')).rejects.toThrow(BadRequestException);
    });

    it('Calcula correctamente si han pasado dias suficientes', async () => {
      const mockCharge = {
        id: '123',
        status: StatusCharge.PENDING,
        dueDate: new Date('2026-08-01T00:00:00.000Z'), // Vencido hace 9 dias
        studentCharges: [
          {
            studentMembershipId: 'stu-1',
            studentMembership: {
              pauses: [],
              courseSeason: {
                billingConfig: { lateFeeEnabled: true, graceDays: 2, lateFeePerDay: 10 },
                pauses: [],
              },
            },
          },
        ],
      };
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockCharge as any);
      
      const res = await service.previewLateFee('123');
      
      expect(res.elapsedDays).toBe(9);
      expect(res.penaltyDays).toBe(7); // 9 - 2
      expect(res.totalLateFeeAmount).toBe(70);
    });

    it('Retorna 0 si no supera graceDays', async () => {
      const mockCharge = {
        id: '123',
        status: StatusCharge.PENDING,
        dueDate: new Date('2026-08-09T00:00:00.000Z'), // Vencido hace 1 dia
        studentCharges: [
          {
            studentMembershipId: 'stu-1',
            studentMembership: {
              pauses: [],
              courseSeason: {
                billingConfig: { lateFeeEnabled: true, graceDays: 2, lateFeePerDay: 10 },
                pauses: [],
              },
            },
          },
        ],
      };
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockCharge as any);
      
      const res = await service.previewLateFee('123');
      
      expect(res.elapsedDays).toBe(1);
      expect(res.penaltyDays).toBe(0);
      expect(res.totalLateFeeAmount).toBe(0);
    });
  });

  describe('applyLateFee', () => {
    it('Falla si totalLateFeeAmount es 0', async () => {
      const mockCharge = {
        id: '123',
        status: StatusCharge.PENDING,
        dueDate: new Date('2026-08-09T00:00:00.000Z'), // Vencido hace 1 dia, graceDays=2
        studentCharges: [
          {
            studentMembershipId: 'stu-1',
            studentMembership: {
              pauses: [],
              courseSeason: {
                billingConfig: { lateFeeEnabled: true, graceDays: 2, lateFeePerDay: 10 },
                pauses: [],
              },
            },
          },
        ],
      };
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockCharge as any);
      
      await expect(service.applyLateFee('123')).rejects.toThrow(BadRequestException);
    });

    it('Falla si ya existe un LATE_FEE pendiente', async () => {
      const mockCharge = {
        id: '123',
        status: StatusCharge.PENDING,
        dueDate: new Date('2026-08-01T00:00:00.000Z'),
        studentCharges: [
          {
            studentMembershipId: 'stu-1',
            studentMembership: {
              pauses: [],
              courseSeason: {
                billingConfig: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 10 },
                pauses: [],
              },
            },
          },
        ],
      };
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockCharge as any);
      lateFeeRepo.findPendingLateFeeCharge.mockResolvedValue({ id: 'late-fee-1' } as any);
      
      await expect(service.applyLateFee('123')).rejects.toThrow('Ya existe un recargo por mora pendiente');
    });

    it('Crea correctamente un LATE_FEE si no hay duplicados y la mora es > 0', async () => {
      const mockCharge = {
        id: '123',
        status: StatusCharge.PENDING,
        dueDate: new Date('2026-08-01T00:00:00.000Z'), // 9 dias
        studentCharges: [
          {
            studentMembershipId: 'stu-1',
            studentMembership: {
              pauses: [],
              courseSeason: {
                billingConfig: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 10 },
                pauses: [],
              },
            },
          },
        ],
      };
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockCharge as any);
      lateFeeRepo.findPendingLateFeeCharge.mockResolvedValue(null);
      lateFeeRepo.createLateFeeCharge.mockResolvedValue({ id: 'new-late-fee' } as any);
      
      const res = await service.applyLateFee('123');
      
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          parentChargeId: '123',
          amount: 90,
          pendingAmount: 90,
        })
      );
      expect(res.data.id).toBe('new-late-fee');
    });
  });
});
