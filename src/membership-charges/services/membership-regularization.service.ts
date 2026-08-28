import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { MembershipChargeRepository } from '../repositories/membership-charge.repository';
import { simulateAllCycles, SimulatedCycle } from '../membership-cycles.engine';
import { TypeMembershipCharge, Prisma } from 'src/generated/prisma/client';
import { MembershipChargeFactory } from '../membership-charge.factory';
import { RegularizeMembershipChargeDto } from '../dto/regularize-membership-charge.dto';
import { calculateRegistrationFee } from '../membership-financial.calculator';
import { formatDiscountsDescription } from '../membership-billing.utils';


export interface RegularizableCycle extends SimulatedCycle {
  cycleId: string;
}

@Injectable()
export class MembershipRegularizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chargeRepo: MembershipChargeRepository,
  ) {}

  public async getRegularizableCycles(
    membershipId: string,
  ): Promise<RegularizableCycle[]> {
    const membership = await this.prisma.playerMembership.findUnique({
      where: { id: membershipId },
      include: {
        paymentPlan: true,
        membershipDiscounts: true,
        pauses: true,
        teamSeason: {
          include: {
            season: true,
            billingConfig: true,
            teamSeasonPauses: true,
          },
        },
        player: { select: { personId: true } },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    const frequency = membership.teamSeason?.billingConfig?.billingFrequency || 'MONTHLY';
    const allCycles = simulateAllCycles(membership);
    const existingChargesSet = await this.fetchExistingChargesSet(membershipId, frequency);

    const regularizableCycles: RegularizableCycle[] = [];
    const currentDate = new Date();

    const registrationFeeBase = Number(membership.teamSeason?.billingConfig?.registrationFee || 0);
    if (registrationFeeBase > 0 && !existingChargesSet.has('REGISTRATION')) {
      const regCalc = calculateRegistrationFee(membership);
      let description = 'Matrícula de inscripción';
      const discountsDesc = formatDiscountsDescription(regCalc.appliedDiscounts);
      if (discountsDesc) {
        description += discountsDesc;
      }

      regularizableCycles.push({
        cycleId: 'REGISTRATION',
        cycleCounter: 0,
        dueDate: membership.startedAt,
        theoreticalDueDate: membership.startedAt,
        nextDueDate: membership.startedAt,
        billingYear: membership.startedAt.getUTCFullYear(),
        billingMonth: membership.startedAt.getUTCMonth() + 1,
        billingCycle: null,
        isFirstCycle: true,
        baseAmount: regCalc.baseAmount,
        adjustmentAmount: regCalc.adjustmentAmount,
        discountPercent: regCalc.discountPercent,
        netAmount: regCalc.netAmount,
        appliedDiscounts: regCalc.appliedDiscounts,
        description: description,
      });
    }

    for (const cycle of allCycles) {
      const cycleKey = this.buildCycleKey(cycle, frequency);
      if (!existingChargesSet.has(cycleKey) && cycle.dueDate <= currentDate) {
        regularizableCycles.push({
          ...cycle,
          cycleId: cycleKey,
        });
      }
    }

    return regularizableCycles;
  }

  public async regularizeCharge(
    membershipId: string,
    dto: RegularizeMembershipChargeDto,
  ) {
    const membership = await this.prisma.playerMembership.findUnique({
      where: { id: membershipId },
      include: {
        paymentPlan: true,
        membershipDiscounts: true,
        pauses: true,
        teamSeason: {
          include: {
            season: true,
            billingConfig: true,
            teamSeasonPauses: true,
          },
        },
        player: { select: { personId: true } },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    const frequency = membership.teamSeason?.billingConfig?.billingFrequency || 'MONTHLY';
    const allCycles = simulateAllCycles(membership);
    const existingChargesSet = await this.fetchExistingChargesSet(membershipId, frequency);

    let targetCycle: SimulatedCycle | undefined;
    const currentDate = new Date();

    if (dto.cycleId === 'REGISTRATION') {
      const registrationFeeBase = Number(membership.teamSeason?.billingConfig?.registrationFee || 0);
      if (registrationFeeBase <= 0) {
        throw new BadRequestException('Esta temporada no requiere matrícula.');
      }
      const regCalc = calculateRegistrationFee(membership);
      let description = 'Matrícula de inscripción';
      const discountsDesc = formatDiscountsDescription(regCalc.appliedDiscounts);
      if (discountsDesc) {
        description += discountsDesc;
      }
      targetCycle = {
        cycleCounter: 0,
        dueDate: membership.startedAt,
        theoreticalDueDate: membership.startedAt,
        nextDueDate: membership.startedAt,
        billingYear: membership.startedAt.getUTCFullYear(),
        billingMonth: membership.startedAt.getUTCMonth() + 1,
        billingCycle: null,
        isFirstCycle: true,
        baseAmount: regCalc.baseAmount,
        adjustmentAmount: regCalc.adjustmentAmount,
        discountPercent: regCalc.discountPercent,
        netAmount: regCalc.netAmount,
        appliedDiscounts: regCalc.appliedDiscounts,
        description: description,
      };
    } else {
      for (const cycle of allCycles) {
        if (this.buildCycleKey(cycle, frequency) === dto.cycleId) {
          if (cycle.dueDate > currentDate) {
            throw new BadRequestException('No puedes regularizar un ciclo futuro.');
          }
          targetCycle = cycle;
          break;
        }
      }
    }

    if (!targetCycle) {
      throw new BadRequestException('El ciclo solicitado no es válido para esta membresía.');
    }

    if (existingChargesSet.has(dto.cycleId)) {
      throw new ConflictException('El ciclo solicitado ya cuenta con un cargo generado o regularizado.');
    }

    const amountToCharge = dto.overrideAmount !== undefined ? dto.overrideAmount : targetCycle.netAmount;
    
    // Si overrideAmount fue proveído, ignoramos el descuento del ciclo oficial para que el Total a pagar sea exacto.
    const adjustmentAmount = dto.overrideAmount !== undefined ? 0 : targetCycle.adjustmentAmount;
    const baseAmount = dto.overrideAmount !== undefined ? dto.overrideAmount : targetCycle.baseAmount;

    let chargePayload: Prisma.ChargeCreateInput;

    if (dto.cycleId === 'REGISTRATION') {
      chargePayload = MembershipChargeFactory.buildRegistrationChargePayload(
        membershipId,
        baseAmount,
        adjustmentAmount,
        targetCycle.description,
        targetCycle.dueDate,
        null,
      );
    } else {
      chargePayload = MembershipChargeFactory.buildRecurringChargePayload(
        membershipId,
        baseAmount,
        adjustmentAmount,
        targetCycle.description,
        targetCycle.dueDate,
        targetCycle.billingYear,
        targetCycle.billingMonth,
        targetCycle.billingCycle,
        null,
      );
    }

    // Sobrescribir createdByCron para marcarlo como regularización manual
    chargePayload.membershipCharges.create['createdByCron'] = false;

    try {
      const result = await this.prisma.charge.create({
        data: chargePayload,
        include: { membershipCharges: true },
      });
      return result;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('El cargo para este ciclo ya fue creado de manera concurrente.');
      }
      throw error;
    }
  }

  private async fetchExistingChargesSet(membershipId: string, frequency?: string): Promise<Set<string>> {
    const existing = await this.chargeRepo.fetchExistingCharges(
      this.prisma,
      membershipId,
      [TypeMembershipCharge.RECURRING_FEE, TypeMembershipCharge.REGISTRATION],
    );
    return new Set(
      existing.map((c) => {
        if (c.type === TypeMembershipCharge.REGISTRATION) {
          return 'REGISTRATION';
        }
        return this.buildCycleKey({
          billingYear: c.billingYear as number,
          billingMonth: c.billingMonth as number,
          billingCycle: c.billingCycle,
        }, frequency);
      }),
    );
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




