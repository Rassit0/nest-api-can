import { Prisma } from 'src/generated/prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StatusCharge, TypeMembershipCharge } from 'src/generated/prisma/client';

export async function recalculatePendingFutureCharges(
    prisma: PrismaService,
    studentMembershipId: string,
    logger: Logger,
    ensureMembershipCharges: any
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingMembershipCharges = await prisma.studentCharge.findMany({
      where: {
        studentMembershipId,
        charge: { status: StatusCharge.PENDING, dueDate: { gte: today } },
        type: { in: [ TypeMembershipCharge.RECURRING_FEE, TypeMembershipCharge.REGISTRATION, TypeMembershipCharge.SEASON_FEE ] },
      },
      include: { charge: true },
    });

    if (pendingMembershipCharges.length === 0) return;

    const fullyPendingChargeIds = pendingMembershipCharges
      .filter((mc) => Number(mc.charge.pendingAmount) === Number(mc.charge.amount))
      .map((mc) => mc.chargeId);

    if (fullyPendingChargeIds.length === 0) return;

    const membership = await prisma.studentMembership.findUnique({
      where: { id: studentMembershipId },
      include: { courseSeason: { include: { billingConfig: true } } }
    });

    const recurringCharges = pendingMembershipCharges.filter(mc => fullyPendingChargeIds.includes(mc.chargeId) && mc.type === TypeMembershipCharge.RECURRING_FEE);
    let resetDate = membership?.nextRecurringChargeGenerationDate || null;
    let oldNextDate = membership?.nextRecurringChargeGenerationDate || null;
    
    if (recurringCharges.length > 0 && membership?.courseSeason) {
      const earliestDueDate = new Date(Math.min(...recurringCharges.map(mc => mc.charge.dueDate.getTime())));
      const calculatedResetDate = new Date(earliestDueDate);
      calculatedResetDate.setUTCDate(calculatedResetDate.getUTCDate() - (membership.courseSeason.billingConfig?.chargeGenerationDaysBefore ?? 0));
      if (!resetDate || calculatedResetDate < resetDate) {
        resetDate = calculatedResetDate;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentCharge.deleteMany({ where: { chargeId: { in: fullyPendingChargeIds } } });
      await tx.charge.deleteMany({ where: { id: { in: fullyPendingChargeIds } } });
      
      if (membership && resetDate) {
        await tx.studentMembership.update({
          where: { id: studentMembershipId },
          data: { nextRecurringChargeGenerationDate: resetDate }
        });
      }
    });

    try {
      if (membership && resetDate) {
        const fakeToday = new Date(Math.max(today.getTime(), oldNextDate ? oldNextDate.getTime() : today.getTime()));
        fakeToday.setUTCHours(23, 59, 59, 999);
        const fullMembership = await prisma.studentMembership.findUnique({
          where: { id: studentMembershipId },
          include: {
            paymentPlan: true,
            studentDiscounts: true,
            courseSeason: {
              include: {
                season: true,
              },
            },
          },
        });
        if (fullMembership) {
           await prisma.$transaction(async (tx) => {
             await ensureMembershipCharges(tx, fullMembership, fakeToday);
           });
        }
      }
    } catch (error) {
      logger.warn(`No se pudo regenerar los cargos tras recálculo para ${studentMembershipId}: ${error.message}`);
    }
}
