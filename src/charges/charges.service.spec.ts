import { Test, TestingModule } from '@nestjs/testing';
import { ChargesService } from './charges.service';
import { PrismaService } from 'src/prisma.service';
import { StatusCharge } from 'src/generated/prisma/client';
import { BadRequestException } from '@nestjs/common';

// Mock the helper function
jest.mock('src/common/helpers/sync-cycle-enrollment.helper', () => ({
  syncCycleEnrollmentStatus: jest.fn(),
}));

describe('ChargesService - Discount Logic', () => {
  let service: ChargesService;
  let prisma: any;

  // We will capture the data sent to `charge.update`
  let updateDataSpy: any;

  beforeEach(async () => {
    updateDataSpy = jest.fn().mockResolvedValue({ id: 'test-id' });

    const mockPrismaService = {
      charge: {
        findUnique: jest.fn(),
        update: updateDataSpy,
      },
      $transaction: jest.fn(async (callback) => {
        // execute the callback passing the mocked prisma client as the transaction object
        return callback({
          charge: {
            update: updateDataSpy,
          },
        });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChargesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ChargesService>(ChargesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const setupCharge = (
    amount: number,
    adjustmentAmount: number,
    pendingAmount: number,
    payments: Array<{ amount: number; status: string }> = [],
  ) => {
    prisma.charge.findUnique.mockResolvedValue({
      id: 'test-id',
      amount: amount,
      adjustmentAmount: adjustmentAmount,
      pendingAmount: pendingAmount,
      payments: payments,
    });
  };

  describe('addAdjustment() and removeAdjustment() rules (Nueva semántica)', () => {
    it('Caso A — Sin ajuste (amount = 500, adjustmentAmount = 0)', async () => {
      setupCharge(500, 0, 500, []);
      await service.addAdjustment('test-id', { adjustmentAmount: 0 });

      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adjustmentAmount: 0,
            pendingAmount: 500,
            status: StatusCharge.PENDING,
          }),
        }),
      );
    });

    it('Caso B — Descuento (amount = 500, adjustmentAmount = -50)', async () => {
      setupCharge(500, 0, 500, []);
      await service.addAdjustment('test-id', { adjustmentAmount: -50 });

      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adjustmentAmount: -50,
            pendingAmount: 450,
            status: StatusCharge.PENDING,
          }),
        }),
      );
    });

    it('Caso C — Recargo (amount = 500, adjustmentAmount = 50)', async () => {
      setupCharge(500, 0, 500, []);
      await service.addAdjustment('test-id', { adjustmentAmount: 50 });

      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adjustmentAmount: 50,
            pendingAmount: 550,
            status: StatusCharge.PENDING,
          }),
        }),
      );
    });

    it('Caso D — Descuento completo (amount = 500, adjustmentAmount = -500)', async () => {
      setupCharge(500, 0, 500, []);
      await service.addAdjustment('test-id', { adjustmentAmount: -500 });

      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adjustmentAmount: -500,
            pendingAmount: 0,
            status: StatusCharge.PAID,
          }),
        }),
      );
    });

    it('Caso E — Descuento que deja total negativo (amount = 500, adjustmentAmount = -501)', async () => {
      setupCharge(500, 0, 500, []);
      await expect(
        service.addAdjustment('test-id', { adjustmentAmount: -501 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Caso F — Edición con pagos existentes', async () => {
      // Estado actual: amount = 500, adjustmentAmount = -50, pendingAmount = 100
      // expectedTotal = 450. paidAmount = 450 - 100 = 350.
      setupCharge(500, -50, 100, [{ amount: 350, status: 'COMPLETED' }]);

      // Modificamos a adjustmentAmount = -20
      // newExpectedTotal = 480. newPending = 480 - 350 = 130.
      await service.addAdjustment('test-id', { adjustmentAmount: -20 });

      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adjustmentAmount: -20,
            pendingAmount: 130,
            status: StatusCharge.PARTIAL,
          }),
        }),
      );
    });

    it('Caso G — Cargo con recargo, pagos existentes', async () => {
      // amount = 500, adjustmentAmount = 50, pendingAmount = 350
      // expectedTotal = 550. paidAmount = 550 - 350 = 200.
      setupCharge(500, 50, 350, [{ amount: 200, status: 'COMPLETED' }]);

      // Removemos el ajuste
      // newExpectedTotal = 500. newPending = 500 - 200 = 300.
      await service.removeAdjustment('test-id');

      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adjustmentAmount: 0,
            pendingAmount: 300,
            status: StatusCharge.PARTIAL,
          }),
        }),
      );
    });

    it('Caso H — isFullyPaidWithMoney (evaluado contra expectedTotal)', async () => {
      // amount = 500, adjustmentAmount = -50, pendingAmount = 0
      // expectedTotal = 450. paidAmount = 450.
      // Ya pagó 450, no pagó 500. Pero 450 >= expectedTotal, por lo que está completamente pagado.
      setupCharge(500, -50, 0, [{ amount: 450, status: 'COMPLETED' }]);

      await expect(
        service.addAdjustment('test-id', { adjustmentAmount: 0 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
