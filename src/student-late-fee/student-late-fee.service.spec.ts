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
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentLateFeeService,
        { provide: StudentLateFeeRepository, useValue: mockLateFeeRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StudentLateFeeService>(StudentLateFeeService);
    lateFeeRepo = module.get(StudentLateFeeRepository);
    prisma = module.get(PrismaService);
  });

  const baseDate = new Date('2026-08-10T00:00:00.000Z');

  beforeAll(() => jest.useFakeTimers().setSystemTime(baseDate));
  afterAll(() => jest.useRealTimers());

  describe('previewLateFee', () => {
    it('Lanza NotFound si el cargo no existe', async () => {
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(null);
      await expect(service.previewLateFee('123')).rejects.toThrow(NotFoundException);
    });

    it('Lanza BadRequest si el cargo esta CANCELLED', async () => {
      lateFeeRepo.findChargeForLateFee.mockResolvedValue({
        id: '123', status: StatusCharge.CANCELLED,
        studentCharges: [{ studentMembership: { pauses: [], courseSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 2, lateFeePerDay: 10 }, pauses: [] } } }],
      } as any);
      await expect(service.previewLateFee('123')).rejects.toThrow(BadRequestException);
      await expect(service.previewLateFee('123')).rejects.toThrow('anulado');
    });

    it('Lanza BadRequest si el cargo ya es de tipo LATE_FEE', async () => {
      lateFeeRepo.findChargeForLateFee.mockResolvedValue({
        id: '123', status: StatusCharge.PENDING,
        studentCharges: [{ type: TypeMembershipCharge.LATE_FEE, studentMembership: { pauses: [], courseSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 2, lateFeePerDay: 10 }, pauses: [] } } }],
      } as any);
      await expect(service.previewLateFee('123')).rejects.toThrow(BadRequestException);
      await expect(service.previewLateFee('123')).rejects.toThrow('recargo por mora');
    });

    it('Calcula correctamente si han pasado dias suficientes', async () => {
      const mockCharge = {
        id: '123', status: StatusCharge.PENDING, dueDate: new Date('2026-08-01T00:00:00.000Z'),
        studentCharges: [{ studentMembership: { pauses: [], courseSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 2, lateFeePerDay: 10 }, pauses: [] } } }],
      };
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockCharge as any);
      
      const res = await service.previewLateFee('123');
      expect(res.elapsedDays).toBe(9);
      expect(res.penaltyDays).toBe(7); // 9 - 2
      expect(res.totalLateFeeAmount).toBe(70);
    });
  });

  describe('applyLateFee', () => {
    it('Falla si customAmount es <= 0', async () => {
      const mockCharge = {
        id: '123', status: StatusCharge.PENDING, dueDate: new Date('2026-08-01T00:00:00.000Z'), 
        studentCharges: [{ studentMembership: { pauses: [], courseSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 10 }, pauses: [] } } }],
      };
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockCharge as any);
      lateFeeRepo.findPendingLateFeeCharge.mockResolvedValue(null);
      
      await expect(service.applyLateFee('123', 0)).rejects.toThrow(BadRequestException);
      await expect(service.applyLateFee('123', -50)).rejects.toThrow(BadRequestException);
    });

    it('Sin customAmount utiliza el calculo automatico', async () => {
      const mockCharge = {
        id: '123', status: StatusCharge.PENDING, dueDate: new Date('2026-08-01T00:00:00.000Z'),
        studentCharges: [{ studentMembership: { pauses: [], courseSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 10 }, pauses: [] } } }],
      };
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockCharge as any);
      lateFeeRepo.findPendingLateFeeCharge.mockResolvedValue(null);
      lateFeeRepo.createLateFeeCharge.mockResolvedValue({ id: 'new-late-fee' } as any);
      
      await service.applyLateFee('123', undefined);
      
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentChargeId: '123', amount: 90, pendingAmount: 90 })
      );
    });

    it('PENDING + customAmount: prioriza el monto manual', async () => {
      const mockCharge = {
        id: '123', status: StatusCharge.PENDING, dueDate: new Date('2026-08-01T00:00:00.000Z'),
        studentCharges: [{ studentMembership: { pauses: [], courseSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 10 }, pauses: [] } } }],
      };
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockCharge as any);
      lateFeeRepo.findPendingLateFeeCharge.mockResolvedValue(null);
      lateFeeRepo.createLateFeeCharge.mockResolvedValue({ id: 'new-late-fee' } as any);
      
      await service.applyLateFee('123', 100); 
      
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentChargeId: '123', amount: 100, pendingAmount: 100 })
      );
    });

    it('PARTIAL + customAmount: genera la mora correctamente', async () => {
      const mockCharge = {
        id: '123', status: StatusCharge.PARTIAL, pendingAmount: 150, dueDate: new Date('2026-08-01T00:00:00.000Z'),
        studentCharges: [{ studentMembership: { pauses: [], courseSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 10 }, pauses: [] } } }],
      };
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockCharge as any);
      lateFeeRepo.findPendingLateFeeCharge.mockResolvedValue(null);
      lateFeeRepo.createLateFeeCharge.mockResolvedValue({ id: 'new-late-fee' } as any);
      
      await service.applyLateFee('123', 80); 
      
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentChargeId: '123', amount: 80, pendingAmount: 80 })
      );
    });

    it('PAID + customAmount: crea LATE_FEE PENDING correctamente y mantiene intacto el padre', async () => {
      const mockCharge = {
        id: '123', status: StatusCharge.PAID, amount: 300, adjustmentAmount: -50, pendingAmount: 0, dueDate: new Date('2026-08-01T00:00:00.000Z'),
        studentCharges: [{ studentMembership: { pauses: [], courseSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 10 }, pauses: [] } } }],
      };
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockCharge as any);
      lateFeeRepo.findPendingLateFeeCharge.mockResolvedValue(null);
      lateFeeRepo.createLateFeeCharge.mockResolvedValue({ id: 'new-late-fee' } as any);
      
      await service.applyLateFee('123', 75); 
      
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          parentChargeId: '123', amount: 75, pendingAmount: 75,
          status: StatusCharge.PENDING, chargeCategory: 'LATE_FEE'
        })
      );

      expect(mockCharge.status).toBe(StatusCharge.PAID);
      expect(mockCharge.pendingAmount).toBe(0);
      expect(mockCharge.amount).toBe(300);
      expect(mockCharge.adjustmentAmount).toBe(-50);
    });
  });

  describe('Generación de Descripción Contextual', () => {
    let mockBaseCharge: any;

    beforeEach(() => {
      mockBaseCharge = {
        id: 'charge-1',
        description: 'Cuota Mes - Julio 2026',
        status: StatusCharge.PENDING,
        dueDate: new Date('2026-08-01T00:00:00.000Z'),
        studentCharges: [{ 
          type: TypeMembershipCharge.REGISTRATION, 
          studentMembershipId: 'mem-1',
          studentMembership: { 
            pauses: [], 
            courseSeason: { 
              billingConfig: { lateFeeEnabled: true, graceDays: 2, lateFeePerDay: 5 }, 
              pauses: [] 
            } 
          } 
        }],
      };
      lateFeeRepo.findPendingLateFeeCharge.mockResolvedValue(null);
      lateFeeRepo.createLateFeeCharge.mockResolvedValue({ id: 'new-late-fee' } as any);
    });

    it('Caso 1: Descripción normal', async () => {
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockBaseCharge);
      await service.applyLateFee('charge-1');
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description: 'Mora sobre: Cuota Mes - Julio 2026',
        })
      );
    });

    it('Caso 2: Descripción personalizada (customAmount)', async () => {
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockBaseCharge);
      await service.applyLateFee('charge-1', 100);
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description: 'Mora sobre: Cuota Mes - Julio 2026 (Monto personalizado)',
        })
      );
    });

    it('Caso 3: Descripción NULL', async () => {
      mockBaseCharge.description = null;
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockBaseCharge);
      await service.applyLateFee('charge-1');
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description: 'Mora sobre: Cargo original',
        })
      );
    });

    it('Caso 4: Descripción vacía', async () => {
      mockBaseCharge.description = '';
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockBaseCharge);
      await service.applyLateFee('charge-1');
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description: 'Mora sobre: Cargo original',
        })
      );
    });

    it('Caso 5: Descripción con espacios', async () => {
      mockBaseCharge.description = '   ';
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockBaseCharge);
      await service.applyLateFee('charge-1');
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description: 'Mora sobre: Cargo original',
        })
      );
    });
  });
});
