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

import {
  calculateRegistrationFee,
  calculateSinglePaymentFee,
} from './student-financial.calculator';

import { simulateAllCycles } from './student-cycles.engine';
import { formatDiscountsDescription } from '../membership-charges/membership-billing.utils';

type StudentMembershipWithRelations = Prisma.StudentMembershipGetPayload<{
  include: {
    paymentPlan: true;
    studentDiscounts: true;
    pauses: true;
    courseSeason: {
      include: {
        season: true;
        billingConfig: true;
        pauses: true;
      };
    };
  };
}>;

const studentMembershipInclude = {
  paymentPlan: true,
  studentDiscounts: true,
  pauses: true,
  courseSeason: {
    include: {
      season: true,
      billingConfig: true,
      pauses: true,
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
      include: { season: true, billingConfig: true },
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
      pauses: [],
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
      const { netAmount: registrationAmount, baseAmount, discountAmount, discountPercent, appliedDiscounts } = calculateRegistrationFee(mockMembership);
      if (baseAmount && baseAmount > 0) {
        chargesToGenerate.push({
          type: TypeMembershipCharge.REGISTRATION,
          description: 'Inscripción' + formatDiscountsDescription(appliedDiscounts),
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
    const billingDay = Number(courseSeason.billingConfig?.billingDay || 1);
    const isSinglePayment = paymentPlan.isSinglePayment || courseSeason.billingConfig?.billingType === 'SINGLE_ONLY';
    const billingFrequency = courseSeason.billingConfig?.billingFrequency || 'MONTHLY';

    let singlePaymentTotalAmount = 0;
    let singlePaymentBaseAmount = 0;
    let singlePaymentDiscountAmount = 0;
    let singlePaymentDiscountPercent = 0;

    const allCycles = isMigrated ? [] : simulateAllCycles(mockMembership as any);
    const advanceCycles = Math.max(1, paymentPlan.advanceCycles || 1);

    for (const cycle of allCycles) {
      if (isSinglePayment) {
        singlePaymentTotalAmount += cycle.netAmount;
        singlePaymentBaseAmount += cycle.baseAmount;
        singlePaymentDiscountAmount += cycle.discountAmount;
        singlePaymentDiscountPercent = cycle.discountPercent;
      } else {
        chargesToGenerate.push({
          type: TypeMembershipCharge.RECURRING_FEE,
          description: cycle.description,
          amount: cycle.netAmount,
          baseAmount: cycle.baseAmount,
          discountAmount: cycle.discountAmount,
          discountPercent: cycle.discountPercent,
          dueDate: cycle.dueDate,
          billingYear: cycle.billingYear,
          billingMonth: cycle.billingMonth,
        });
        
        if (cycle.cycleCounter >= advanceCycles) {
            break;
        }
      }
    }
    
    const singlePayment = calculateSinglePaymentFee(mockMembership as any, singlePaymentBaseAmount, singlePaymentDiscountPercent);
    
    if (isSinglePayment && !isMigrated && singlePayment.hasSinglePaymentAmount) {
      chargesToGenerate.push({
        type: TypeMembershipCharge.SEASON_FEE,
        description: singlePayment.description,
        amount: singlePayment.netAmount,
        baseAmount: singlePayment.baseAmount,
        discountAmount: singlePayment.discountAmount,
        discountPercent: singlePayment.discountPercent,
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
      const { netAmount: registrationAmount, baseAmount, discountAmount, discountPercent, appliedDiscounts } = calculateRegistrationFee(membership);
      if (baseAmount && baseAmount > 0) {
        chargesToGenerate.push({
          type: TypeMembershipCharge.REGISTRATION,
          description: 'Inscripción' + formatDiscountsDescription(appliedDiscounts),
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
    const billingDay = Number(membership.courseSeason.billingConfig?.billingDay || 1);
    const isSinglePayment = membership.paymentPlan.isSinglePayment || membership.courseSeason.billingConfig?.billingType === 'SINGLE_ONLY';
    const billingFrequency = membership.courseSeason.billingConfig?.billingFrequency || 'MONTHLY';
    let keepGenerating = true;
    const hasSinglePaymentCharge = existingCharges.some(
      (c) => (c.type === TypeMembershipCharge.SEASON_FEE || c.type === TypeMembershipCharge.RECURRING_FEE) && c.billingYear === membership.startedAt.getUTCFullYear() && c.billingMonth === membership.startedAt.getUTCMonth() + 1
    );

    if (isSinglePayment && hasSinglePaymentCharge) keepGenerating = false;

    let singlePaymentTotalAmount = 0;
    let singlePaymentBaseAmount = 0;
    let singlePaymentDiscountAmount = 0;
    let singlePaymentDiscountPercent = 0;
    
    let advanceCycles = Math.max(1, membership.paymentPlan?.advanceCycles || 1);
    let firstDueDate: Date | null = null;
    let firstBillingYear: number = 0;
    let firstBillingMonth: number = 0;
    
    const allCycles = simulateAllCycles(membership as any);

    for (const cycle of allCycles) {
      const hasMonthly = existingCharges.some(
        (c) => c.type === TypeMembershipCharge.RECURRING_FEE && c.billingYear === cycle.billingYear && c.billingMonth === cycle.billingMonth
      );

      if (isSinglePayment) {
        singlePaymentTotalAmount += cycle.netAmount;
        singlePaymentBaseAmount += cycle.baseAmount;
        singlePaymentDiscountAmount += cycle.discountAmount;
        singlePaymentDiscountPercent = cycle.discountPercent;
      } else {
        if (!hasMonthly) {
            if (!firstDueDate) {
                firstDueDate = cycle.dueDate;
                firstBillingYear = cycle.billingYear;
                firstBillingMonth = cycle.billingMonth;
            }
            
            chargesToGenerate.push({
              type: TypeMembershipCharge.RECURRING_FEE,
              description: cycle.description,
              amount: cycle.netAmount,
              baseAmount: cycle.baseAmount,
              discountAmount: cycle.discountAmount,
              discountPercent: cycle.discountPercent,
              dueDate: firstDueDate as Date,
              billingYear: cycle.billingYear,
              billingMonth: cycle.billingMonth,
            });

            const currentGenerated = chargesToGenerate.filter(c => c.type === TypeMembershipCharge.RECURRING_FEE).length;
            
            if (currentGenerated >= advanceCycles) {
                break;
            }
        }
      }
    }
    
    const singlePayment = calculateSinglePaymentFee(membership as any, singlePaymentBaseAmount, singlePaymentDiscountPercent);
    
    if (isSinglePayment && !membership.isMigrated && singlePayment.hasSinglePaymentAmount && !hasSinglePaymentCharge) {
      chargesToGenerate.push({
        type: TypeMembershipCharge.SEASON_FEE,
        description: singlePayment.description,
        amount: singlePayment.netAmount,
        baseAmount: singlePayment.baseAmount,
        discountAmount: singlePayment.discountAmount,
        discountPercent: singlePayment.discountPercent,
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
        courseSeason: { 
          season: { endDate: { gte: today } },
          billingConfig: { isEngineActive: true }
        },
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
    const { netAmount, appliedDiscounts } = calculateRegistrationFee(membership);
    if (netAmount <= 0) return;
    await this.createCharge(tx, membership.id, { description: 'Inscripción' + formatDiscountsDescription(appliedDiscounts), amount: netAmount, dueDate: membership.startedAt }, TypeMembershipCharge.REGISTRATION, membership.startedAt.getUTCFullYear(), membership.startedAt.getUTCMonth() + 1, null);
  }

  private async ensureRecurringCharges(tx: Prisma.TransactionClient, membership: StudentMembershipWithRelations, today: Date) {
    let nextPointer = membership.nextRecurringChargeGenerationDate;
    let generationDate = membership.nextRecurringChargeGenerationDate;
    const seasonEnd = new Date(membership.courseSeason.season.endDate);
    seasonEnd.setUTCHours(23, 59, 59, 999);
    const billingDay = Number(membership.courseSeason.billingConfig?.billingDay || 1);
    const isSinglePayment = membership.paymentPlan.isSinglePayment || membership.courseSeason.billingConfig?.billingType === 'SINGLE_ONLY';
    const billingFrequency = membership.courseSeason.billingConfig?.billingFrequency || 'MONTHLY';
    const advanceCycles = Math.max(1, membership.paymentPlan?.advanceCycles || 1);

    const allCycles = simulateAllCycles(membership as any);

    if (!generationDate) {
      if (membership.isMigrated) {
        let tempPointer = new Date(membership.startedAt);
        for (const cycle of allCycles) {
          const dueStartOfDay = new Date(cycle.dueDate);
          dueStartOfDay.setUTCHours(0, 0, 0, 0);
          const todayStartOfDay = new Date(today);
          todayStartOfDay.setUTCHours(0, 0, 0, 0);
          if (dueStartOfDay < todayStartOfDay) {
            const nextGenerationDate = new Date(cycle.nextDueDate);
            nextGenerationDate.setUTCDate(nextGenerationDate.getUTCDate() - (membership.courseSeason.billingConfig?.chargeGenerationDaysBefore || 7));
            if (cycle.nextDueDate > seasonEnd) { tempPointer = new Date(0); break; }
            tempPointer = nextGenerationDate;
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
            let singlePaymentBaseAmount = 0;
            let singlePaymentDiscountPercent = 0;
            
            for (const cycle of allCycles) {
                singlePaymentBaseAmount += cycle.baseAmount;
                singlePaymentDiscountPercent = cycle.discountPercent;
            }
            
            const singlePayment = calculateSinglePaymentFee(membership as any, singlePaymentBaseAmount, singlePaymentDiscountPercent);
            
            if (singlePayment.hasSinglePaymentAmount) {
                await this.createCharge(tx, membership.id, { description: singlePayment.description, amount: singlePayment.netAmount, dueDate: membership.startedAt }, TypeMembershipCharge.SEASON_FEE, startBillingYear, startBillingMonth);
            }
        }
        nextPointer = null;
    } else {
        let currentCycleCounter = 1;
        
        if (membership.isMigrated || generationDate > membership.startedAt) {
           let tempPointer = new Date(membership.startedAt);
           for (const cycle of allCycles) {
              if (tempPointer >= generationDate) break;
              tempPointer = new Date(cycle.nextDueDate);
              tempPointer.setUTCDate(tempPointer.getUTCDate() - (membership.courseSeason.billingConfig?.chargeGenerationDaysBefore || 7));
              currentCycleCounter++;
           }
        }
        
        while (generationDate && generationDate <= today) {
          const cycle = allCycles[currentCycleCounter - 1];
          if (!cycle) break;
          
          const exists = await tx.studentCharge.findFirst({
            where: { studentMembershipId: membership.id, type: TypeMembershipCharge.RECURRING_FEE, billingYear: cycle.billingYear, billingMonth: cycle.billingMonth, billingCycle: billingFrequency === 'MONTHLY' ? null : cycle.billingCycle },
          });

          if (exists) {
            const nextGenerationDate = new Date(cycle.nextDueDate);
            nextGenerationDate.setUTCDate(nextGenerationDate.getUTCDate() - (membership.courseSeason.billingConfig?.chargeGenerationDaysBefore || 7));
            if (cycle.nextDueDate > seasonEnd) { nextPointer = null; break; }
            nextPointer = nextGenerationDate;
            generationDate = nextGenerationDate;
            currentCycleCounter++;
            continue;
          }

          let groupDueDate = cycle.dueDate;
          let cyclePointer = currentCycleCounter;
          let lastNextDueDate = cycle.nextDueDate;

          for (let i = 0; i < advanceCycles; i++) {
             const c = allCycles[cyclePointer - 1];
             if (!c) break;
             if (i > 0 && c.dueDate > seasonEnd) { break; }
             
             if (c.netAmount >= 0) {
                 await tx.charge.create({
                     data: {
                         description: c.description,
                         amount: c.netAmount,
                         pendingAmount: c.netAmount,
                         dueDate: groupDueDate,
                         status: c.netAmount > 0 ? 'PENDING' : 'PAID',
                         studentCharges: {
                             create: {
                                 studentMembershipId: membership.id,
                                 type: TypeMembershipCharge.RECURRING_FEE,
                                 billingYear: c.billingYear,
                                 billingMonth: c.billingMonth,
                                 billingCycle: billingFrequency === 'MONTHLY' ? null : c.billingCycle,
                             }
                         }
                     }
                 });
             }
             
             lastNextDueDate = c.nextDueDate;
             cyclePointer++;
             
             if (c.nextDueDate > seasonEnd) { break; }
          }

          const nextGenerationDate = new Date(lastNextDueDate);
          nextGenerationDate.setUTCDate(nextGenerationDate.getUTCDate() - (membership.courseSeason.billingConfig?.chargeGenerationDaysBefore || 7));
          if (lastNextDueDate > seasonEnd) { nextPointer = null; break; }
          nextPointer = nextGenerationDate;
          generationDate = nextGenerationDate;
          currentCycleCounter = cyclePointer;
        }
    }
    if (membership.nextRecurringChargeGenerationDate?.getTime() !== nextPointer?.getTime()) {
      await tx.studentMembership.update({ where: { id: membership.id }, data: { nextRecurringChargeGenerationDate: nextPointer } });
    }
  }

  async recalculatePendingFutureCharges(studentMembershipId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingMembershipCharges = await this.prisma.studentCharge.findMany({
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

    const membership = await this.prisma.studentMembership.findUnique({
      where: { id: studentMembershipId },
      include: { courseSeason: { include: { billingConfig: true } } }
    });

    const recurringCharges = pendingMembershipCharges.filter(mc => fullyPendingChargeIds.includes(mc.chargeId) && mc.type === TypeMembershipCharge.RECURRING_FEE);
    let resetDate = membership?.nextRecurringChargeGenerationDate || null;
    let oldNextDate = membership?.nextRecurringChargeGenerationDate || null;
    
    if (recurringCharges.length > 0 && membership?.courseSeason) {
      const earliestDueDate = new Date(Math.min(...recurringCharges.map(mc => mc.charge.dueDate.getTime())));
      const targetResetDate = new Date(earliestDueDate);
      targetResetDate.setUTCDate(targetResetDate.getUTCDate() - (membership.courseSeason.billingConfig?.chargeGenerationDaysBefore || 7));
      if (!resetDate || targetResetDate < resetDate) { resetDate = targetResetDate; }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.studentCharge.deleteMany({ where: { chargeId: { in: fullyPendingChargeIds } } });
      await tx.charge.deleteMany({ where: { id: { in: fullyPendingChargeIds } } });
      if (resetDate && (!oldNextDate || resetDate.getTime() !== oldNextDate.getTime())) {
        await tx.studentMembership.update({ where: { id: studentMembershipId }, data: { nextRecurringChargeGenerationDate: resetDate } });
      }
    });

    this.logger.log(`Recalculados cargos futuros para estudiante membresía ${studentMembershipId}. Se eliminaron ${fullyPendingChargeIds.length} cargos puramente pendientes.`);
    
    await this.generateChargesForNewMembership(studentMembershipId);
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
