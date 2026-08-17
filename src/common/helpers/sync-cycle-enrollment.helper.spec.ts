import { syncCycleEnrollmentStatus } from './sync-cycle-enrollment.helper';
import { StatusCharge, CycleEnrollmentStatus } from 'src/generated/prisma/client';

describe('syncCycleEnrollmentStatus Helper', () => {
  let txMock: any;

  beforeEach(() => {
    txMock = {
      cycleEnrollment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
  });

  it('PAID -> CONFIRMED', async () => {
    await syncCycleEnrollmentStatus(txMock, 'charge-1', StatusCharge.PAID);
    expect(txMock.cycleEnrollment.updateMany).toHaveBeenCalledWith({
      where: { chargeId: 'charge-1', status: { not: CycleEnrollmentStatus.CONFIRMED } },
      data: { status: CycleEnrollmentStatus.CONFIRMED },
    });
  });

  it('PENDING -> PENDING', async () => {
    await syncCycleEnrollmentStatus(txMock, 'charge-1', StatusCharge.PENDING);
    expect(txMock.cycleEnrollment.updateMany).toHaveBeenCalledWith({
      where: { chargeId: 'charge-1', status: { not: CycleEnrollmentStatus.PENDING } },
      data: { status: CycleEnrollmentStatus.PENDING },
    });
  });

  it('PARTIAL -> PENDING', async () => {
    await syncCycleEnrollmentStatus(txMock, 'charge-1', StatusCharge.PARTIAL);
    expect(txMock.cycleEnrollment.updateMany).toHaveBeenCalledWith({
      where: { chargeId: 'charge-1', status: { not: CycleEnrollmentStatus.PENDING } },
      data: { status: CycleEnrollmentStatus.PENDING },
    });
  });

  it('CANCELLED -> CANCELLED', async () => {
    await syncCycleEnrollmentStatus(txMock, 'charge-1', StatusCharge.CANCELLED);
    expect(txMock.cycleEnrollment.updateMany).toHaveBeenCalledWith({
      where: { chargeId: 'charge-1', status: { not: CycleEnrollmentStatus.CANCELLED } },
      data: { status: CycleEnrollmentStatus.CANCELLED },
    });
  });

  it('REGISTRATION / LATE_FEE / TeamSeason no estallan (updateMany maneja graceful miss)', async () => {
    // Simulamos que Prisma retorna count 0 para charges sin cycleEnrollment
    txMock.cycleEnrollment.updateMany.mockResolvedValue({ count: 0 });
    await syncCycleEnrollmentStatus(txMock, 'charge-no-enrollment', StatusCharge.PAID);
    expect(txMock.cycleEnrollment.updateMany).toHaveBeenCalledWith({
      where: { chargeId: 'charge-no-enrollment', status: { not: CycleEnrollmentStatus.CONFIRMED } },
      data: { status: CycleEnrollmentStatus.CONFIRMED },
    });
    // No debe lanzar error
  });
});