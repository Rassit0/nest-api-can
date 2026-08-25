import { syncCycleEnrollmentStatus } from './sync-cycle-enrollment.helper';
import { StatusCharge, CycleEnrollmentStatus } from 'src/generated/prisma/client';

describe('syncCycleEnrollmentStatus Helper', () => {
  let txMock: any;

  beforeEach(() => {
    txMock = {
      cycleEnrollment: {
        findMany: jest.fn().mockResolvedValue([{ id: '1', createdAt: new Date() }]),
        update: jest.fn().mockResolvedValue({}),
      },
      studentMembership: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
  });

  it('PAID -> CONFIRMED', async () => {
    await syncCycleEnrollmentStatus(txMock, 'charge-1', StatusCharge.PAID);
    expect(txMock.cycleEnrollment.findMany).toHaveBeenCalledWith({
      where: { chargeId: 'charge-1', status: { not: CycleEnrollmentStatus.CONFIRMED } },
      include: expect.any(Object),
    });
    expect(txMock.cycleEnrollment.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { status: CycleEnrollmentStatus.CONFIRMED },
    });
  });

  it('PENDING -> PENDING', async () => {
    await syncCycleEnrollmentStatus(txMock, 'charge-1', StatusCharge.PENDING);
    expect(txMock.cycleEnrollment.findMany).toHaveBeenCalledWith({
      where: { chargeId: 'charge-1', status: { not: CycleEnrollmentStatus.PENDING } },
      include: expect.any(Object),
    });
    expect(txMock.cycleEnrollment.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { status: CycleEnrollmentStatus.PENDING },
    });
  });

  it('PARTIAL -> PENDING', async () => {
    await syncCycleEnrollmentStatus(txMock, 'charge-1', StatusCharge.PARTIAL);
    expect(txMock.cycleEnrollment.findMany).toHaveBeenCalledWith({
      where: { chargeId: 'charge-1', status: { not: CycleEnrollmentStatus.PENDING } },
      include: expect.any(Object),
    });
    expect(txMock.cycleEnrollment.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { status: CycleEnrollmentStatus.PENDING },
    });
  });

  it('CANCELLED -> CANCELLED', async () => {
    await syncCycleEnrollmentStatus(txMock, 'charge-1', StatusCharge.CANCELLED);
    expect(txMock.cycleEnrollment.findMany).toHaveBeenCalledWith({
      where: { chargeId: 'charge-1', status: { not: CycleEnrollmentStatus.CANCELLED } },
      include: expect.any(Object),
    });
    expect(txMock.cycleEnrollment.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { status: CycleEnrollmentStatus.CANCELLED },
    });
  });

  it('REGISTRATION / LATE_FEE / TeamSeason no estallan (updateMany maneja graceful miss)', async () => {
    // Simulamos que Prisma retorna array vacio para charges sin cycleEnrollment
    txMock.cycleEnrollment.findMany.mockResolvedValue([]);
    await syncCycleEnrollmentStatus(txMock, 'charge-no-enrollment', StatusCharge.PAID);
    expect(txMock.cycleEnrollment.findMany).toHaveBeenCalledWith({
      where: { chargeId: 'charge-no-enrollment', status: { not: CycleEnrollmentStatus.CONFIRMED } },
      include: expect.any(Object),
    });
    // No debe lanzar error y no debe llamar a update
    expect(txMock.cycleEnrollment.update).not.toHaveBeenCalled();
  });
});