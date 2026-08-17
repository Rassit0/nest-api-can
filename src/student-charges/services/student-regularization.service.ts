import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { getAbsoluteSeasonCycles, buildCycleDescription, MILLISECONDS_IN_DAY } from '../student-billing.utils';
import { TypeMembershipCharge, Prisma } from 'src/generated/prisma/client';
import { StudentChargeFactory } from '../student-charge.factory';
import { RegularizeStudentChargeDto } from '../dto/regularize-student-charge.dto';

import { calculateOnDemandCycleFee } from '../student-financial.calculator';


@Injectable()
export class StudentRegularizationService {
  constructor(private readonly prisma: PrismaService) {}

  public async getRegularizableCycles(
    membershipId: string,
  ): Promise<any[]> {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id: membershipId },
      include: {
        studentDiscounts: true,
        courseSeason: {
          include: {
            season: true,
            billingConfig: true,
            pauses: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Student Membership not found');
    }

    const seasonStartDate = (membership as any).courseSeason.season.startDate;
    const seasonEndDate = (membership as any).courseSeason.season.endDate;
    const frequency = (membership as any).courseSeason.billingConfig?.billingFrequency || 'MONTHLY';

    const allCycles = getAbsoluteSeasonCycles(seasonStartDate, seasonEndDate, frequency);
    
    // Fetch existing charges to filter out
    const existingCharges = await this.prisma.studentCharge.findMany({
      where: {
        studentMembershipId: membershipId,
        type: TypeMembershipCharge.RECURRING_FEE,
      },
      select: {
        billingYear: true,
        billingMonth: true,
        billingCycle: true,
      },
    });

    const existingChargesSet = new Set(
      existingCharges.map((c) => this.buildCycleKey(c, frequency))
    );

    const regularizableCycles: any[] = [];
    const currentDate = new Date();

    for (const cycle of allCycles) {
      const cycleKey = this.buildCycleKey(cycle, frequency);
      if (!existingChargesSet.has(cycleKey) && cycle.cycleStartDate <= currentDate) {
        
        const cycleTotalDays = Math.max(1, (cycle.cycleEndDate.getTime() - cycle.cycleStartDate.getTime()) / MILLISECONDS_IN_DAY);
        // Para regularización histórica, asumimos que se cobra el ciclo completo (factor = 1)
        const calc = calculateOnDemandCycleFee(
            membership as any,
            cycle,
            cycleTotalDays,
            cycleTotalDays
        );

        regularizableCycles.push({
          cycleId: cycleKey,
          cycleStartDate: cycle.cycleStartDate,
          cycleEndDate: cycle.cycleEndDate,
          billingYear: cycle.billingYear,
          billingMonth: cycle.billingMonth,
          billingCycle: cycle.billingCycle,
          baseAmount: calc.baseAmount,
          netAmount: calc.netAmount,
          discountAmount: calc.discountAmount,
          discountReason: null,
          title: buildCycleDescription(cycle.cycleStartDate, cycle.cycleEndDate, frequency),
        });
      }
    }

    return regularizableCycles;
  }

  public async regularizeCharge(
    membershipId: string,
    dto: RegularizeStudentChargeDto,
  ) {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id: membershipId },
      include: {
        studentDiscounts: true,
        courseSeason: {
          include: {
            season: true,
            billingConfig: true,
            pauses: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Student Membership not found');
    }

    const seasonStartDate = (membership as any).courseSeason.season.startDate;
    const seasonEndDate = (membership as any).courseSeason.season.endDate;
    const frequency = (membership as any).courseSeason.billingConfig?.billingFrequency || 'MONTHLY';

    const allCycles = getAbsoluteSeasonCycles(seasonStartDate, seasonEndDate, frequency);
    
    // Fetch existing
    const existingCharges = await this.prisma.studentCharge.findMany({
      where: {
        studentMembershipId: membershipId,
        type: TypeMembershipCharge.RECURRING_FEE,
      },
      select: {
        billingYear: true,
        billingMonth: true,
        billingCycle: true,
      },
    });

    const existingChargesSet = new Set(
      existingCharges.map((c) => this.buildCycleKey(c, frequency))
    );

    let targetCycle: any = null;
    let targetCalc: any = null;
    const currentDate = new Date();
    
    for (const cycle of allCycles) {
      if (this.buildCycleKey(cycle, frequency) === dto.cycleId) {
        if (cycle.cycleStartDate > currentDate) {
          throw new BadRequestException('No puedes regularizar un ciclo futuro o que aún no ha iniciado.');
        }
        targetCycle = cycle;
        const cycleTotalDays = Math.max(1, (cycle.cycleEndDate.getTime() - cycle.cycleStartDate.getTime()) / MILLISECONDS_IN_DAY);
        targetCalc = calculateOnDemandCycleFee(
            membership as any,
            cycle,
            cycleTotalDays,
            cycleTotalDays
        );
        break;
      }
    }

    if (!targetCycle) {
      throw new BadRequestException('El ciclo solicitado no es válido para esta membresía de escuela.');
    }

    if (existingChargesSet.has(dto.cycleId)) {
      throw new ConflictException('El ciclo solicitado ya cuenta con un cargo generado o regularizado.');
    }

    const discountAmount = dto.overrideAmount !== undefined ? 0 : targetCalc.discountAmount;
    const baseAmount = dto.overrideAmount !== undefined ? dto.overrideAmount : targetCalc.baseAmount;
    const targetFreq = (membership as any).courseSeason.billingConfig?.billingFrequency || 'MONTHLY';
    const description = buildCycleDescription(targetCycle.cycleStartDate, targetCycle.cycleEndDate, targetFreq);

    const chargePayload = StudentChargeFactory.buildRecurringChargePayload(
      membershipId,
      baseAmount,
      discountAmount,
      description,
      targetCycle.cycleEndDate,
      targetCycle.billingYear,
      targetCycle.billingMonth,
      targetCycle.billingCycle,
      null,
    );

    // Sobrescribir createdByCron para marcarlo como regularización manual
    chargePayload.studentCharges.create['createdByCron'] = false;

    try {
      const result = await this.prisma.charge.create({
        data: chargePayload,
        include: { studentCharges: true },
      });
      return result;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('El cargo para este ciclo ya fue creado de manera concurrente.');
      }
      throw error;
    }
  }

  private buildCycleKey(cycle: {
    billingYear: number;
    billingMonth: number;
    billingCycle?: number | null;
  }, frequency?: string): string {
    if (frequency === 'MONTHLY') {
      return `${cycle.billingYear}-${cycle.billingMonth}-MONTHLY`;
    }
    return `${cycle.billingYear}-${cycle.billingMonth}-${cycle.billingCycle ?? 'NONE'}`;
  }
}



