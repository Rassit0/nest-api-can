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
    discountAmount: number,
    pendingAmount: number,
    payments: Array<{ amount: number; status: string }> = [],
  ) => {
    prisma.charge.findUnique.mockResolvedValue({
      id: 'test-id',
      amount: amount,
      discountAmount: discountAmount,
      pendingAmount: pendingAmount,
      payments: payments,
    });
  };

  describe('addDiscount() and removeDiscount() rules', () => {
    it('1. Cargo de Bs. 100 sin descuento', async () => {
      // Un cargo nuevo: amount 100, pending 100
      setupCharge(100, 0, 100, []);
      
      // Simulamos que se agrega un descuento de 0 (sólo para disparar el cálculo)
      await service.addDiscount('test-id', { discountAmount: 0 });

      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pendingAmount: 100,
            status: StatusCharge.PENDING,
          }),
        }),
      );
    });

    it('2. Pago real de Bs. 40', async () => {
      // amount 100, pending 60, payments=[{amount: 40, status: 'COMPLETED'}]
      setupCharge(100, 0, 60, [{ amount: 40, status: 'COMPLETED' }]);
      
      await service.addDiscount('test-id', { discountAmount: 0 });

      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pendingAmount: 60,
            status: StatusCharge.PARTIAL,
          }),
        }),
      );
    });

    it('3. Descuento de Bs. 60 sobre el caso anterior (PAID, reversible)', async () => {
      // Caso 2: ya pagó 40. Ahora le aplicamos 60 de descuento.
      setupCharge(100, 0, 60, [{ amount: 40, status: 'COMPLETED' }]);

      await service.addDiscount('test-id', { discountAmount: 60, discountReason: 'Beca' });

      // paidAmount = 40. newExpectedTotal = 100 - 60 = 40. newPending = 40 - 40 = 0.
      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountAmount: 60,
            pendingAmount: 0,
            status: StatusCharge.PAID,
          }),
        }),
      );
    });

    it('4. Cargo de Bs. 100 con descuento de Bs. 100', async () => {
      setupCharge(100, 0, 100, []);

      await service.addDiscount('test-id', { discountAmount: 100 });

      // paidAmount = 0. newExpectedTotal = 100 - 100 = 0. newPending = 0 - 0 = 0.
      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountAmount: 100,
            pendingAmount: 0,
            status: StatusCharge.PAID,
          }),
        }),
      );
    });

    it('5. Cargo de Bs. 100 pagado completamente con dinero real', async () => {
      // paidAmount = 100.
      setupCharge(100, 0, 0, [{ amount: 100, status: 'COMPLETED' }]);

      // Si intentamos agregar un descuento a un cargo ya pagado completamente con dinero real,
      // el sistema debe rechazarlo con un BadRequestException, protegiendo el pago.
      await expect(
        service.addDiscount('test-id', { discountAmount: 50 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('6. Cargo de Bs. 100, pago 50 y descuento 50', async () => {
      // Estado actual: pago 50, descuento 50, pending = 0
      setupCharge(100, 50, 0, [{ amount: 50, status: 'COMPLETED' }]);

      // Al remover el descuento, el expectedTotal vuelve a 100.
      // paidAmount es 50. newPending = 100 - 50 = 50. status = PARTIAL.
      await service.removeDiscount('test-id');

      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountAmount: 0,
            pendingAmount: 50,
            status: StatusCharge.PARTIAL,
          }),
        }),
      );
    });

    it('7. Reversión de un descuento que había liquidado el cargo (100%)', async () => {
      // Cargo de 100, con descuento de 100, pagos 0.
      setupCharge(100, 100, 0, []);

      // Se remueve el descuento
      await service.removeDiscount('test-id');

      // expectedTotal = 100. paidAmount = 0. newPending = 100. status = PENDING.
      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountAmount: 0,
            pendingAmount: 100,
            status: StatusCharge.PENDING,
          }),
        }),
      );
    });

    it('8. Reversión de pago combinada con descuento (cancelación de pago)', async () => {
      // Si un pago de 50 es cancelado, no debe sumarse al paidAmount.
      // Cargo 100, descuento 0. Pagos: uno de 50 CANCELLED.
      setupCharge(100, 0, 100, [{ amount: 50, status: 'CANCELLED' }]);

      await service.addDiscount('test-id', { discountAmount: 50 });

      // paidAmount = 0 (porque no hay pagos COMPLETED).
      // newExpectedTotal = 100 - 50 = 50.
      // newPending = 50. status = PARTIAL? No, status = PENDING.
      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountAmount: 50,
            pendingAmount: 50,
            status: StatusCharge.PENDING,
          }),
        }),
      );
    });
  });
});
