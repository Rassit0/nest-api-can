import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateStudentChargeDto } from './dto/create-student-charge.dto';
import { UpdateStudentChargeDto } from './dto/update-student-charge.dto';
import { PreviewStudentChargesDto } from './dto/preview-student-charges.dto';
import { CreateManualChargeDto } from './dto/create-manual-charge.dto';
import { StudentChargesPaginationDto } from './dto/pagination.dto';
import { PrismaService } from 'src/prisma.service';
import {
  Charge,
  StudentMembershipStatus,
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';

type StudentMembershipWithRelations = Prisma.StudentMembershipGetPayload<{
  include: {
    paymentPlan: true;
    studentDiscounts: true;
    courseSeason: {
      include: {
        season: true;
      };
    };
  };
}>;

const studentMembershipInclude = {
  paymentPlan: true,
  studentDiscounts: true,
  courseSeason: {
    include: {
      season: true,
    },
  },
} as const;

@Injectable()
export class StudentChargesService {
  private readonly logger = new Logger(StudentChargesService.name);

  private readonly MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  constructor(private readonly prisma: PrismaService) {}

  async previewCharges(data: PreviewStudentChargesDto) {
    const { courseSeasonId, paymentPlanId, startDate, studentDiscounts = [], isMigrated } = data;

    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id: courseSeasonId },
      include: { season: true },
    });

    if (!courseSeason) throw new BadRequestException('Temporada de escuela no encontrada');

    const paymentPlan = await this.prisma.paymentPlan.findUnique({
      where: { id: paymentPlanId },
    });

    if (!paymentPlan) throw new BadRequestException('Plan de pago no encontrado');

    const mockStartedAt = new Date(startDate);
    const seasonStart = new Date(courseSeason.season.startDate);
    seasonStart.setUTCHours(0, 0, 0, 0);
    const seasonEndValidation = new Date(courseSeason.season.endDate);
    seasonEndValidation.setUTCHours(23, 59, 59, 999);

    if (mockStartedAt < seasonStart || mockStartedAt > seasonEndValidation) {
      throw new BadRequestException('La fecha de inicio debe estar dentro de la duración de la temporada');
    }

    const parsedDiscounts = studentDiscounts.map((d) => ({
      ...d,
      startDate: new Date(d.startDate),
      endDate: d.endDate ? new Date(d.endDate) : null,
    }));

    const mockMembership = {
      startedAt: mockStartedAt,
      courseSeason,
      paymentPlan,
      studentDiscounts: parsedDiscounts,
      isMigrated: isMigrated || false,
    } as unknown as StudentMembershipWithRelations;

    const chargesToGenerate: {
      type: TypeMembershipCharge;
      description: string;
      amount: number;
      baseAmount?: number;
      discountAmount?: number;
      discountPercent?: number;
      dueDate: Date;
      billingYear: number;
      billingMonth: number;
    }[] = [];

    if (!isMigrated) {
      const { netAmount: registrationAmount, baseAmount, discountAmount, discountPercent, appliedDiscounts } = this.calculateRegistrationFee(mockMembership);
      if (baseAmount && baseAmount > 0) {
        chargesToGenerate.push({
          type: TypeMembershipCharge.REGISTRATION,
          description: 'Inscripción' + this.formatDiscountsDescription(appliedDiscounts),
          amount: registrationAmount,
          baseAmount,
          discountAmount,
          discountPercent,
          dueDate: mockMembership.startedAt,
          billingYear: mockMembership.startedAt.getUTCFullYear(),
          billingMonth: mockMembership.startedAt.getUTCMonth() + 1,
        });
      }
    }

    const seasonEnd = new Date(courseSeason.season.endDate);
    seasonEnd.setUTCHours(23, 59, 59, 999);
    const billingDay = Number(courseSeason.billingDay);
    const isSinglePayment = paymentPlan.isSinglePayment || courseSeason.billingType === 'SINGLE_ONLY';
    const billingFrequency = courseSeason.billingFrequency || 'MONTHLY';

    let keepGenerating = true;
    if (isMigrated) keepGenerating = false;

    let singlePaymentTotalAmount = 0;
    let singlePaymentBaseAmount = 0;
    let singlePaymentDiscountAmount = 0;
    let singlePaymentDiscountPercent = 0;
    let cycleCounter = 1;

    while (keepGenerating && cycleCounter < 120) {
      const { dueDate, theoreticalDueDate, nextDueDate, billingYear, billingMonth, billingCycle } = this.calculateCycleDates(
        mockMembership.startedAt, seasonEnd, billingDay, billingFrequency, cycleCounter
      );
      
      const isFirstCycle = cycleCounter === 1;
      let description = this.buildCycleDescription(mockMembership as any, billingFrequency, billingYear, billingMonth, billingCycle);

      if (isFirstCycle && nextDueDate) {
        const cycleDays = Math.round((nextDueDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const activeDays = Math.max(0, Math.round((nextDueDate.getTime() - mockMembership.startedAt.getTime()) / (1000 * 60 * 60 * 24)));
        if (activeDays > 0 && activeDays !== cycleDays) {
          description += ' (Prorrateado: cubre ' + activeDays + ' de ' + cycleDays + ' días)';
        }
      }

      if (isSinglePayment && nextDueDate > seasonEnd) {
        const cycleDays = Math.round((nextDueDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const activeDays = Math.max(0, Math.round((seasonEnd.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        if (activeDays > 0 && activeDays !== cycleDays) {
            description += ' (Prorrateo de salida: cubre ' + activeDays + ' de ' + cycleDays + ' días)';
        }
      }

      const { netAmount: amount, baseAmount, discountAmount, discountPercent, appliedDiscounts } = this.calculateRecurringFeeForDate(
        mockMembership as any, dueDate, isFirstCycle, nextDueDate, seasonEnd, theoreticalDueDate
      );

      description += this.formatDiscountsDescription(appliedDiscounts);

      if (isSinglePayment) {
        singlePaymentTotalAmount += amount;
        singlePaymentBaseAmount += (baseAmount || 0);
        singlePaymentDiscountAmount += (discountAmount || 0);
        singlePaymentDiscountPercent = discountPercent || 0;
      } else {
        if (baseAmount && baseAmount > 0) {
          chargesToGenerate.push({
            type: TypeMembershipCharge.RECURRING_FEE,
            description,
            amount,
            baseAmount,
            discountAmount,
            discountPercent,
            dueDate,
            billingYear,
            billingMonth,
          });
        }
        break;
      }

      if (nextDueDate > seasonEnd) {
        keepGenerating = false;
        break;
      }
      cycleCounter++;
    }

    const hasSinglePaymentAmount = singlePaymentBaseAmount > 0 || Number(courseSeason.seasonFee || 0) > 0;
    
    if (isSinglePayment && !isMigrated && hasSinglePaymentAmount) {
      if (courseSeason.seasonFee) {
        singlePaymentBaseAmount = Number(courseSeason.seasonFee);
        if (courseSeason.prorateSeasonFee && courseSeason.season) {
            const startDate = new Date(courseSeason.season.startDate);
            const endDate = new Date(courseSeason.season.endDate);
            const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
            const activeDays = Math.max(0, Math.round((endDate.getTime() - mockMembership.startedAt.getTime()) / (1000 * 60 * 60 * 24)));
            const factor = Math.min(1, activeDays / totalDays);
            singlePaymentBaseAmount = singlePaymentBaseAmount * factor;
        }
        singlePaymentDiscountPercent = Number(paymentPlan.seasonFeeDiscountPercent || 0);
        singlePaymentDiscountAmount = Number(((singlePaymentBaseAmount * singlePaymentDiscountPercent) / 100).toFixed(2));
        singlePaymentTotalAmount = Number(Math.max(0, singlePaymentBaseAmount - singlePaymentDiscountAmount).toFixed(2));
      }

      let seasonFeeDesc = 'Pago Completo - Temporada';
      if (singlePaymentDiscountPercent > 0) {
          seasonFeeDesc += this.formatDiscountsDescription([{ percent: singlePaymentDiscountPercent, reason: 'Plan de pago' }]);
      }

      chargesToGenerate.push({
        type: TypeMembershipCharge.SEASON_FEE,
        description: seasonFeeDesc,
        amount: singlePaymentTotalAmount,
        baseAmount: singlePaymentBaseAmount,
        discountAmount: singlePaymentDiscountAmount,
        discountPercent: singlePaymentDiscountPercent,
        dueDate: mockMembership.startedAt,
        billingYear: mockMembership.startedAt.getUTCFullYear(),
        billingMonth: mockMembership.startedAt.getUTCMonth() + 1,
      });
    }

    const totalBaseAmount = chargesToGenerate.reduce((sum, c) => sum + (c.baseAmount || 0), 0);
    const totalDiscountAmount = chargesToGenerate.reduce((sum, c) => sum + (c.discountAmount || 0), 0);
    const totalNetAmount = chargesToGenerate.reduce((sum, c) => sum + c.amount, 0);

    return { charges: chargesToGenerate, breakdown: { totalBaseAmount, totalDiscount: totalDiscountAmount, totalNetAmount, currency: 'BOB' } };
  }

  async previewExistingCharges(membershipId: string) {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id: membershipId },
      include: studentMembershipInclude,
    });
    if (!membership) throw new BadRequestException('Membresía no encontrada');
    const existingCharges = await this.prisma.studentCharge.findMany({
      where: { studentMembershipId: membershipId },
      select: { type: true, billingYear: true, billingMonth: true },
    });

    const chargesToGenerate: { type: TypeMembershipCharge; description: string; amount: number; baseAmount?: number; discountAmount?: number; discountPercent?: number; dueDate: Date; billingYear: number; billingMonth: number; }[] = [];

    const hasRegistration = existingCharges.some((c) => c.type === TypeMembershipCharge.REGISTRATION);
    if (!hasRegistration) {
      const { netAmount: registrationAmount, baseAmount, discountAmount, discountPercent, appliedDiscounts } = this.calculateRegistrationFee(membership);
      if (baseAmount && baseAmount > 0) {
        chargesToGenerate.push({
          type: TypeMembershipCharge.REGISTRATION,
          description: 'Inscripción' + this.formatDiscountsDescription(appliedDiscounts),
          amount: registrationAmount,
          dueDate: membership.startedAt,
          billingYear: membership.startedAt.getUTCFullYear(),
          billingMonth: membership.startedAt.getUTCMonth() + 1,
          ...({ baseAmount, discountAmount, discountPercent })
        });
      }
    }

    const seasonEnd = new Date(membership.courseSeason.season.endDate);
    seasonEnd.setUTCHours(23, 59, 59, 999);
    const billingDay = Number(membership.courseSeason.billingDay);
    const isSinglePayment = membership.paymentPlan.isSinglePayment || membership.courseSeason.billingType === 'SINGLE_ONLY';
    const billingFrequency = membership.courseSeason.billingFrequency || 'MONTHLY';
    let keepGenerating = true;
    const hasSinglePaymentCharge = existingCharges.some(
      (c) => (c.type === TypeMembershipCharge.SEASON_FEE || c.type === TypeMembershipCharge.RECURRING_FEE) && c.billingYear === membership.startedAt.getUTCFullYear() && c.billingMonth === membership.startedAt.getUTCMonth() + 1
    );

    if (isSinglePayment && hasSinglePaymentCharge) keepGenerating = false;

    let singlePaymentTotalAmount = 0;
    let singlePaymentBaseAmount = 0;
    let singlePaymentDiscountAmount = 0;
    let singlePaymentDiscountPercent = 0;
    let cycleCounter = 1;

    while (keepGenerating && cycleCounter < 120) {
      const { dueDate, theoreticalDueDate, nextDueDate, billingYear, billingMonth, billingCycle } = this.calculateCycleDates(
        membership.startedAt, seasonEnd, billingDay, billingFrequency, cycleCounter
      );
      
      const isFirstCycle = cycleCounter === 1;
      let description = this.buildCycleDescription(membership as any, billingFrequency, billingYear, billingMonth, billingCycle);

      if (isFirstCycle && nextDueDate) {
        const cycleDays = Math.round((nextDueDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const activeDays = Math.max(0, Math.round((nextDueDate.getTime() - membership.startedAt.getTime()) / (1000 * 60 * 60 * 24)));
        if (activeDays > 0 && activeDays !== cycleDays) {
          description += ' (Prorrateo por ' + activeDays + ' días)';
        }
      }
      
      if (isSinglePayment && nextDueDate > seasonEnd) {
        const cycleDays = Math.round((nextDueDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const activeDays = Math.max(0, Math.round((seasonEnd.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        if (activeDays > 0 && activeDays !== cycleDays) {
            description += ' (Prorrateo final por ' + activeDays + ' días)';
        }
      }

      const hasMonthly = existingCharges.some(
        (c) => c.type === TypeMembershipCharge.RECURRING_FEE && c.billingYear === billingYear && c.billingMonth === billingMonth
      );

      const { netAmount: amount, baseAmount, discountAmount, discountPercent, appliedDiscounts } = this.calculateRecurringFeeForDate(
        membership, dueDate, isFirstCycle, nextDueDate, seasonEnd, theoreticalDueDate
      );

      description += this.formatDiscountsDescription(appliedDiscounts);

      if (isSinglePayment) {
        singlePaymentTotalAmount += amount;
        singlePaymentBaseAmount += (baseAmount || 0);
        singlePaymentDiscountAmount += (discountAmount || 0);
        singlePaymentDiscountPercent = discountPercent || 0;
      } else {
        if (!hasMonthly) {
            if (baseAmount && baseAmount > 0) {
              chargesToGenerate.push({
                type: TypeMembershipCharge.RECURRING_FEE, description, amount, dueDate, billingYear, billingMonth, ...({ baseAmount, discountAmount, discountPercent })
              });
            }
            break;
        }
      }

      if (nextDueDate > seasonEnd) { keepGenerating = false; break; }
      cycleCounter++;
    }
    
    const hasSinglePaymentAmount = singlePaymentBaseAmount > 0 || Number(membership.courseSeason.seasonFee || 0) > 0;
    
    if (isSinglePayment && hasSinglePaymentAmount && !hasSinglePaymentCharge) {
      if (membership.courseSeason.seasonFee) {
        singlePaymentBaseAmount = Number(membership.courseSeason.seasonFee);
        if (membership.courseSeason.prorateSeasonFee && membership.courseSeason.season) {
            const startDate = new Date(membership.courseSeason.season.startDate);
            const endDate = new Date(membership.courseSeason.season.endDate);
            const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
            const activeDays = Math.max(0, Math.round((endDate.getTime() - membership.startedAt.getTime()) / (1000 * 60 * 60 * 24)));
            const factor = Math.min(1, activeDays / totalDays);
            singlePaymentBaseAmount = singlePaymentBaseAmount * factor;
        }
        singlePaymentDiscountPercent = Number(membership.paymentPlan.seasonFeeDiscountPercent || 0);
        singlePaymentDiscountAmount = Number(((singlePaymentBaseAmount * singlePaymentDiscountPercent) / 100).toFixed(2));
        singlePaymentTotalAmount = Number(Math.max(0, singlePaymentBaseAmount - singlePaymentDiscountAmount).toFixed(2));
      }

      let seasonFeeDesc = 'Pago Completo - Temporada';
      if (singlePaymentDiscountPercent > 0) {
          seasonFeeDesc += this.formatDiscountsDescription([{ percent: singlePaymentDiscountPercent, reason: 'Plan de pago' }]);
      }

      chargesToGenerate.push({
        type: TypeMembershipCharge.SEASON_FEE,
        description: seasonFeeDesc,
        amount: singlePaymentTotalAmount,
        baseAmount: singlePaymentBaseAmount,
        discountAmount: singlePaymentDiscountAmount,
        discountPercent: singlePaymentDiscountPercent,
        dueDate: membership.startedAt,
        billingYear: membership.startedAt.getUTCFullYear(),
        billingMonth: membership.startedAt.getUTCMonth() + 1,
      });
    }
    const totalBaseAmount = chargesToGenerate.reduce((sum, c) => sum + (c.baseAmount || 0), 0);
    const totalDiscountAmount = chargesToGenerate.reduce((sum, c) => sum + (c.discountAmount || 0), 0);
    const totalNetAmount = chargesToGenerate.reduce((sum, c) => sum + c.amount, 0);

    return { charges: chargesToGenerate, breakdown: { totalBaseAmount, totalDiscount: totalDiscountAmount, totalNetAmount, currency: 'BOB' } };
  }

  async applyDailyStudentCharges() {
    this.logger.log('Iniciando proceso diario de cálculo de cargos...');
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const memberships = await this.prisma.studentMembership.findMany({
      where: {
        status: { in: [ StudentMembershipStatus.ACTIVE, StudentMembershipStatus.SUSPENDED ] },
        OR: [ { nextRecurringChargeGenerationDate: { lte: today } }, { nextRecurringChargeGenerationDate: null } ],
        courseSeason: { season: { endDate: { gte: today } } },
      },
      include: studentMembershipInclude,
    });
    this.logger.log('Se encontraron ' + memberships.length + ' membresías activas o pendientes.');
    for (const membership of memberships) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.ensureStudentCharges(tx, membership, today);
        });
      } catch (error) {
        this.logger.error('Error procesando cargos para la membresía ID ' + membership.id + ':', error);
      }
    }
    this.logger.log('Proceso de cargos finalizado.');
  }

  async generateNextChargeManually(membershipId: string) {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id: membershipId },
      include: studentMembershipInclude,
    });
    if (!membership) throw new BadRequestException('Membresía no encontrada');
    if (!membership.nextRecurringChargeGenerationDate) throw new BadRequestException('La membresía no tiene próximas cuotas programadas (fin de temporada o no inicializada)');
    const fakeToday = new Date(membership.nextRecurringChargeGenerationDate);
    fakeToday.setUTCHours(23, 59, 59, 999);
    await this.prisma.$transaction(async (tx) => {
      await this.ensureRecurringCharges(tx, membership, fakeToday);
    });
    return { message: 'Próxima cuota generada por adelantado exitosamente' };
  }

  async generateChargesForNewMembership(membershipId: string) {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id: membershipId },
      include: studentMembershipInclude,
    });
    if (!membership) return;
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    try {
      await this.prisma.$transaction(async (tx) => { await this.ensureStudentCharges(tx, membership, today); });
      this.logger.log('Cargos generados/actualizados para nueva membresía ' + membershipId);
    } catch (error) {
      this.logger.error('Error generando cargos para nueva membresía ID ' + membershipId + ':', error);
    }
  }

  private async ensureStudentCharges(tx: Prisma.TransactionClient, membership: StudentMembershipWithRelations, today: Date) {
    if (!membership.isMigrated) { await this.ensureRegistrationCharge(tx, membership); }
    await this.ensureRecurringCharges(tx, membership, today);
  }

  private async ensureRegistrationCharge(tx: Prisma.TransactionClient, membership: StudentMembershipWithRelations) {
    const exists = await tx.studentCharge.findFirst({
      where: { studentMembershipId: membership.id, type: TypeMembershipCharge.REGISTRATION, billingYear: membership.startedAt.getUTCFullYear(), billingMonth: membership.startedAt.getUTCMonth() + 1, billingCycle: null },
    });
    if (exists) return;
    const { netAmount, appliedDiscounts } = this.calculateRegistrationFee(membership);
    if (netAmount <= 0) return;
    await this.createCharge(tx, membership.id, { description: 'Inscripción' + this.formatDiscountsDescription(appliedDiscounts), amount: netAmount, dueDate: membership.startedAt }, TypeMembershipCharge.REGISTRATION, membership.startedAt.getUTCFullYear(), membership.startedAt.getUTCMonth() + 1, null);
  }

  private async ensureRecurringCharges(tx: Prisma.TransactionClient, membership: StudentMembershipWithRelations, today: Date) {
    let nextPointer = membership.nextRecurringChargeGenerationDate;
    let generationDate = membership.nextRecurringChargeGenerationDate;
    const seasonEnd = new Date(membership.courseSeason.season.endDate);
    seasonEnd.setUTCHours(23, 59, 59, 999);
    const billingDay = Number(membership.courseSeason.billingDay);
    const isSinglePayment = membership.paymentPlan.isSinglePayment || membership.courseSeason.billingType === 'SINGLE_ONLY';
    const billingFrequency = membership.courseSeason.billingFrequency || 'MONTHLY';

    if (!generationDate) {
      if (membership.isMigrated) {
        let tempPointer = new Date(membership.startedAt);
        let cycleCounter = 1;
        while (true) {
          const { dueDate, nextDueDate } = this.calculateCycleDates(membership.startedAt, seasonEnd, billingDay, billingFrequency, cycleCounter);
          const dueStartOfDay = new Date(dueDate);
          dueStartOfDay.setUTCHours(0, 0, 0, 0);
          const todayStartOfDay = new Date(today);
          todayStartOfDay.setUTCHours(0, 0, 0, 0);
          if (dueStartOfDay < todayStartOfDay) {
            const nextGenerationDate = new Date(nextDueDate);
            nextGenerationDate.setUTCDate(nextGenerationDate.getUTCDate() - membership.courseSeason.chargeGenerationDaysBefore);
            if (nextDueDate > seasonEnd) { tempPointer = new Date(0); break; }
            tempPointer = nextGenerationDate;
            cycleCounter++;
          } else { break; }
        }
        if (tempPointer.getTime() === 0) {
          await tx.studentMembership.update({ where: { id: membership.id }, data: { nextRecurringChargeGenerationDate: null } });
          return;
        }
        generationDate = tempPointer;
      } else {
        generationDate = new Date(membership.startedAt);
      }
    }

    if (isSinglePayment) {
        if (membership.isMigrated) {
            if (membership.nextRecurringChargeGenerationDate !== null) {
              await tx.studentMembership.update({ where: { id: membership.id }, data: { nextRecurringChargeGenerationDate: null } });
            }
            return;
        }
        const startBillingYear = membership.startedAt.getUTCFullYear();
        const startBillingMonth = membership.startedAt.getUTCMonth() + 1;
        const exists = await tx.studentCharge.findFirst({
            where: { studentMembershipId: membership.id, type: { in: [TypeMembershipCharge.SEASON_FEE, TypeMembershipCharge.RECURRING_FEE] }, billingYear: startBillingYear, billingMonth: startBillingMonth },
        });
        if (!exists) {
            let keepGenerating = true;
            let singlePaymentTotalAmount = 0;
            let singlePaymentBaseAmount = 0;
            let singlePaymentDiscountAmount = 0;
            let singlePaymentDiscountPercent = 0;
            let cycleCounter = 1;
            while (keepGenerating && cycleCounter < 120) {
                const { dueDate, theoreticalDueDate, nextDueDate } = this.calculateCycleDates(membership.startedAt, seasonEnd, billingDay, billingFrequency, cycleCounter);
                const isFirstCycle = cycleCounter === 1;
                const { netAmount: amount, baseAmount, discountAmount, discountPercent } = this.calculateRecurringFeeForDate(membership, dueDate, isFirstCycle, nextDueDate, seasonEnd, theoreticalDueDate);
                singlePaymentTotalAmount += amount;
                singlePaymentBaseAmount += (baseAmount || 0);
                singlePaymentDiscountAmount += (discountAmount || 0);
                singlePaymentDiscountPercent = discountPercent || 0;
                if (nextDueDate > seasonEnd) { keepGenerating = false; break; }
                cycleCounter++;
            }
            const hasSinglePaymentAmount = singlePaymentBaseAmount > 0 || Number(membership.courseSeason.seasonFee || 0) > 0;
            if (hasSinglePaymentAmount) {
                if (membership.courseSeason.seasonFee) {
                    singlePaymentBaseAmount = Number(membership.courseSeason.seasonFee);
                    if (membership.courseSeason.prorateSeasonFee && membership.courseSeason.season) {
                        const startDate = new Date(membership.courseSeason.season.startDate);
                        const endDate = new Date(membership.courseSeason.season.endDate);
                        const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
                        const activeDays = Math.max(0, Math.round((endDate.getTime() - membership.startedAt.getTime()) / (1000 * 60 * 60 * 24)));
                        const factor = Math.min(1, activeDays / totalDays);
                        singlePaymentBaseAmount = singlePaymentBaseAmount * factor;
                    }
                    singlePaymentDiscountPercent = Number(membership.paymentPlan.seasonFeeDiscountPercent || 0);
                    singlePaymentDiscountAmount = Number(((singlePaymentBaseAmount * singlePaymentDiscountPercent) / 100).toFixed(2));
                    singlePaymentTotalAmount = Number(Math.max(0, singlePaymentBaseAmount - singlePaymentDiscountAmount).toFixed(2));
                }
                
                let seasonFeeDesc = 'Pago Completo - Temporada';
                if (singlePaymentDiscountPercent > 0) {
                    seasonFeeDesc += this.formatDiscountsDescription([{ percent: singlePaymentDiscountPercent, reason: 'Plan de pago' }]);
                }

                await this.createCharge(tx, membership.id, { description: seasonFeeDesc, amount: singlePaymentTotalAmount, dueDate: membership.startedAt }, TypeMembershipCharge.SEASON_FEE, startBillingYear, startBillingMonth);
            }
        }
        nextPointer = null;
    } else {
        let currentCycleCounter = 1;
        if (membership.isMigrated || generationDate > membership.startedAt) {
           let tempPointer = new Date(membership.startedAt);
           while (tempPointer < generationDate && currentCycleCounter < 120) {
              const { nextDueDate } = this.calculateCycleDates(membership.startedAt, seasonEnd, billingDay, billingFrequency, currentCycleCounter);
              tempPointer = new Date(nextDueDate);
              tempPointer.setUTCDate(tempPointer.getUTCDate() - membership.courseSeason.chargeGenerationDaysBefore);
              currentCycleCounter++;
           }
        }
        while (generationDate && generationDate <= today) {
          const { dueDate, theoreticalDueDate, nextDueDate, billingYear, billingMonth, billingCycle } = this.calculateCycleDates(membership.startedAt, seasonEnd, billingDay, billingFrequency, currentCycleCounter);
          const isFirstCycle = currentCycleCounter === 1;
          let description = this.buildCycleDescription(membership as any, billingFrequency, billingYear, billingMonth, billingCycle);
          if (isFirstCycle && nextDueDate) {
            const cycleDays = Math.round((nextDueDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            const activeDays = Math.max(0, Math.round((nextDueDate.getTime() - membership.startedAt.getTime()) / (1000 * 60 * 60 * 24)));
            if (activeDays > 0 && activeDays !== cycleDays) {
              description += ' (Prorrateo por ' + activeDays + ' días)';
            }
          }
          const exists = await tx.studentCharge.findFirst({
            where: { studentMembershipId: membership.id, type: TypeMembershipCharge.RECURRING_FEE, billingYear, billingMonth, billingCycle: billingFrequency === 'MONTHLY' ? null : billingCycle },
          });
          if (!exists) {
            const { netAmount, appliedDiscounts } = this.calculateRecurringFeeForDate(membership, dueDate, isFirstCycle, nextDueDate, seasonEnd, theoreticalDueDate);
            description += this.formatDiscountsDescription(appliedDiscounts);

            if (netAmount > 0) {
              await this.createCharge(tx, membership.id, { description, amount: netAmount, dueDate }, TypeMembershipCharge.RECURRING_FEE, billingYear, billingMonth, billingFrequency === 'MONTHLY' ? null : billingCycle);
            }
          }
          const nextGenerationDate = new Date(nextDueDate);
          nextGenerationDate.setUTCDate(nextGenerationDate.getUTCDate() - membership.courseSeason.chargeGenerationDaysBefore);
          if (nextDueDate > seasonEnd) { nextPointer = null; break; }
          nextPointer = nextGenerationDate;
          generationDate = nextGenerationDate;
          currentCycleCounter++;
        }
    }
    if (membership.nextRecurringChargeGenerationDate?.getTime() !== nextPointer?.getTime()) {
      await tx.studentMembership.update({ where: { id: membership.id }, data: { nextRecurringChargeGenerationDate: nextPointer } });
    }
  }

  private calculateRegistrationFee(
    membership: StudentMembershipWithRelations,
  ): { baseAmount: number; discountPercent: number; discountAmount: number; netAmount: number; appliedDiscounts: { percent: number; reason?: string; endDate?: Date | null }[] } {
    let base = Number(membership.courseSeason.registrationFee || 0);
    if (membership.courseSeason.prorateRegistrationFee && membership.courseSeason.season) {
      const startDate = new Date(membership.courseSeason.season.startDate);
      const endDate = new Date(membership.courseSeason.season.endDate);
      const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const activeDays = Math.max(0, Math.round((endDate.getTime() - membership.startedAt.getTime()) / (1000 * 60 * 60 * 24)));
      const factor = Math.min(1, activeDays / totalDays);
      base = base * factor;
    }

    const appliedDiscounts: { percent: number; reason?: string; endDate?: Date | null }[] = [];
    const ppRegDiscount = Number(membership.paymentPlan?.registrationDiscountPercent || 0);
    if (ppRegDiscount > 0) {
      appliedDiscounts.push({ percent: ppRegDiscount, reason: 'Plan de pago' });
    }

    const activeRegDiscounts = (membership.studentDiscounts || []).filter((d) => {
      const date = membership.startedAt;
      return d.startDate <= date && (!d.endDate || d.endDate >= date);
    });

    for (const d of activeRegDiscounts) {
      const p = Number(d.registrationDiscountPercent || 0);
      if (p > 0) {
        appliedDiscounts.push({ percent: p, reason: d.reason || d.type, endDate: d.endDate });
      }
    }

    const discount = Math.min(100, appliedDiscounts.reduce((sum, d) => sum + d.percent, 0));

    let discountAmount = (base * discount) / 100;
    discountAmount = Number(discountAmount.toFixed(2));
    let netAmount = Number(Math.max(0, base - discountAmount).toFixed(2));
    return { baseAmount: Number(base.toFixed(2)), discountPercent: Number(discount.toFixed(2)), discountAmount, netAmount, appliedDiscounts };
  }

  private calculateRecurringFeeForDate(
    membership: StudentMembershipWithRelations, dueDate: Date, isFirstCycle: boolean = false, nextDueDate?: Date, seasonEnd?: Date, theoreticalDueDate?: Date,
  ): { baseAmount: number; discountPercent: number; discountAmount: number; netAmount: number; appliedDiscounts: { percent: number; reason?: string; endDate?: Date | null }[] } {
    let base = Number(membership.courseSeason.recurringFee || 0);
    let factor = 1;
    if (isFirstCycle && nextDueDate && theoreticalDueDate) {
      if (membership.courseSeason.prorateFirstRecurringFee !== false) {
        const cycleDays = Math.round((nextDueDate.getTime() - theoreticalDueDate.getTime()) / (1000 * 60 * 60 * 24));
        const activeDays = Math.round((nextDueDate.getTime() - membership.startedAt.getTime()) / (1000 * 60 * 60 * 24));
        factor = Math.max(0, cycleDays > 0 ? activeDays / cycleDays : 1);
      }
    } else if (nextDueDate && seasonEnd && nextDueDate > seasonEnd) {
      if (membership.courseSeason.prorateLastRecurringFee !== false) {
        const cycleDays = Math.round((nextDueDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const activeDays = Math.round((seasonEnd.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        factor = Math.max(0, cycleDays > 0 ? activeDays / cycleDays : 1);
      }
    }
    base = base * factor;

    const appliedDiscounts: { percent: number; reason?: string; endDate?: Date | null }[] = [];
    const ppRecDiscount = Number(membership.paymentPlan?.recurringDiscountPercent || 0);
    if (ppRecDiscount > 0) {
      appliedDiscounts.push({ percent: ppRecDiscount, reason: 'Plan de pago' });
    }

    const activeRecDiscounts = (membership.studentDiscounts || []).filter((d) => {
      const evalDate = dueDate < membership.startedAt ? membership.startedAt : dueDate;
      return d.startDate <= evalDate && (!d.endDate || d.endDate >= evalDate);
    });

    for (const d of activeRecDiscounts) {
      const p = Number(d.recurringDiscountPercent || 0);
      if (p > 0) {
        appliedDiscounts.push({ percent: p, reason: d.reason || d.type, endDate: d.endDate });
      }
    }

    const discount = Math.min(100, appliedDiscounts.reduce((sum, d) => sum + d.percent, 0));

    let discountAmount = (base * discount) / 100;
    discountAmount = Number(discountAmount.toFixed(2));
    let netAmount = Number(Math.max(0, base - discountAmount).toFixed(2));
    return { baseAmount: Number(base.toFixed(2)), discountPercent: Number(discount.toFixed(2)), discountAmount, netAmount, appliedDiscounts };
  }
  
  private calculateCycleDates(startDate: Date, seasonEndDate: Date, billingDay: number, billingFrequency: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'SINGLE', cycleCounter: number) {
    let dueDate = new Date(startDate);
    let nextDueDate = new Date(startDate);
    let theoreticalDueDate = new Date(startDate);
    
    if (billingFrequency === 'WEEKLY' || billingFrequency === 'BIWEEKLY') {
      const daysToAdd = billingFrequency === 'WEEKLY' ? 7 : 14;
      dueDate.setUTCDate(dueDate.getUTCDate() + (cycleCounter - 1) * daysToAdd);
      theoreticalDueDate = new Date(dueDate);
      nextDueDate.setUTCDate(dueDate.getUTCDate() + daysToAdd);
      const billingYear = theoreticalDueDate.getUTCFullYear();
      const billingMonth = theoreticalDueDate.getUTCMonth() + 1;
      return { dueDate, theoreticalDueDate, nextDueDate, billingYear, billingMonth, billingCycle: cycleCounter };
    } else {
      let currentBillingYear = startDate.getUTCFullYear();
      let currentBillingMonth = startDate.getUTCMonth();
      const maxDaysInStartMonth = new Date(Date.UTC(currentBillingYear, currentBillingMonth + 1, 0)).getUTCDate();
      const safeStartBillingDay = Math.min(billingDay, maxDaysInStartMonth);
      const thisMonthBillingDate = new Date(Date.UTC(currentBillingYear, currentBillingMonth, safeStartBillingDay));
      if (startDate < thisMonthBillingDate) {
        currentBillingMonth -= 1;
        if (currentBillingMonth < 0) { currentBillingMonth = 11; currentBillingYear -= 1; }
      }
      let targetMonth = currentBillingMonth + (cycleCounter - 1);
      let targetYear = currentBillingYear;
      while (targetMonth > 11) { targetMonth -= 12; targetYear += 1; }
      const maxDaysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
      const safeTargetBillingDay = Math.min(billingDay, maxDaysInTargetMonth);
      theoreticalDueDate = new Date(Date.UTC(targetYear, targetMonth, safeTargetBillingDay));
      let nextTargetMonth = targetMonth + 1;
      let nextTargetYear = targetYear;
      if (nextTargetMonth > 11) { nextTargetMonth = 0; nextTargetYear += 1; }
      const maxDaysInNextMonth = new Date(Date.UTC(nextTargetYear, nextTargetMonth + 1, 0)).getUTCDate();
      const safeNextBillingDay = Math.min(billingDay, maxDaysInNextMonth);
      nextDueDate = new Date(Date.UTC(nextTargetYear, nextTargetMonth, safeNextBillingDay));
      dueDate = new Date(theoreticalDueDate);
      if (cycleCounter === 1) { dueDate = new Date(startDate); }
      let billingYear = theoreticalDueDate.getUTCFullYear();
      let billingMonthNum = theoreticalDueDate.getUTCMonth() + 1;
      return { dueDate, theoreticalDueDate, nextDueDate, billingYear: billingYear, billingMonth: billingMonthNum, billingCycle: cycleCounter };
    }
  }

  private buildCycleDescription(membership: any, billingFrequency: string, billingYear: number, billingMonth: number, billingCycle: number) {
    const capitalizedMonthName = this.MONTH_NAMES[billingMonth - 1];
    if (billingFrequency === 'WEEKLY') { return 'Semana ' + billingCycle + ' - ' + capitalizedMonthName + ' ' + billingYear; }
    if (billingFrequency === 'BIWEEKLY') { return 'Quincena ' + billingCycle + ' - ' + capitalizedMonthName + ' ' + billingYear; }
    return this.buildRecurringDescription(membership, billingYear, billingMonth, capitalizedMonthName);
  }

  private buildRecurringDescription(membership: any, billingYear: number, billingMonth: number, monthName: string): string {
    const isEnrollmentMonth = billingYear === membership.startedAt.getUTCFullYear() && billingMonth - 1 === membership.startedAt.getUTCMonth();
    if (isEnrollmentMonth) { return 'Primera Mensualidad - ' + monthName + ' ' + billingYear; }
    return 'Mensualidad - ' + monthName + ' ' + billingYear;
  }

  private formatDiscountsDescription(appliedDiscounts: { percent: number; reason?: string; endDate?: Date | null }[]): string {
    if (appliedDiscounts.length === 0) return '';
    const descParts = appliedDiscounts.map((d) => {
      let text = '-' + d.percent + '%';
      if (d.reason) text += ' ' + d.reason;
      if (d.endDate) {
        text += ' hasta el ' + d.endDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
      }
      return text;
    });
    return ' (' + descParts.join(', ') + ')';
  }

  private async createCharge(tx: Prisma.TransactionClient, studentMembershipId: string, charge: { description: string; amount: number; dueDate: Date; }, type: TypeMembershipCharge, billingYear: number, billingMonth: number, billingCycle?: number | null) {
    await tx.charge.create({
      data: {
        description: charge.description,
        amount: charge.amount,
        pendingAmount: charge.amount,
        dueDate: charge.dueDate,
        status: StatusCharge.PENDING,
        studentCharges: { create: { studentMembershipId, type, billingYear, billingMonth, billingCycle, }, },
      },
    });
  }

  async createManualCharge(dto: CreateManualChargeDto) {
    const membership = await this.prisma.studentMembership.findUnique({ where: { id: dto.membershipId }, });
    if (!membership) throw new BadRequestException('Membresía no encontrada');
    const dueDate = new Date(dto.dueDate);
    await this.prisma.$transaction(async (tx) => {
      await this.createCharge(tx, membership.id, { description: dto.description, amount: dto.amount, dueDate, }, TypeMembershipCharge.MANUAL, dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1);
    });
    return { message: 'Cargo manual creado exitosamente' };
  }

  async findAll(paginationDto: StudentChargesPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search = '',
      sortField = 'createdAt',
      orderBy = 'desc',
    } = paginationDto;

    const where: Prisma.StudentChargeWhereInput = {};

    if (search) {
      where.charge = {
        description: {
          contains: search,
          mode: 'insensitive',
        },
      };
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.studentCharge.count({ where }),
      this.prisma.studentCharge.findMany({
        where,
        take: per_page,
        skip: (page - 1) * per_page,
        orderBy: {
          [sortField]: orderBy,
        },
        include: {
          charge: true,
          studentMembership: {
            include: {
              student: {
                include: {
                  person: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data,
      meta: {
        current_page: page,
        last_page: Math.ceil(total / per_page),
        per_page,
        total,
      },
    };
  }

  async findOne(id: string) {
    const charge = await this.prisma.studentCharge.findUnique({
      where: { id },
      include: {
        charge: true,
        studentMembership: {
          include: {
            student: {
              include: {
                person: true,
              },
            },
          },
        },
      },
    });

    if (!charge) {
      throw new BadRequestException('Cargo escolar no encontrado');
    }

    return charge;
  }

  async update(id: string, updateStudentChargeDto: UpdateStudentChargeDto) {
    // Implementación mínima para mantener el contrato
    return { message: 'Operación no soportada' };
  }

  async remove(id: string) {
    const charge = await this.prisma.studentCharge.findUnique({
      where: { id },
    });

    if (!charge) {
      throw new BadRequestException('Cargo escolar no encontrado');
    }

    await this.prisma.charge.delete({
      where: { id: charge.chargeId },
    });

    return { message: 'Cargo escolar eliminado exitosamente' };
  }
}
