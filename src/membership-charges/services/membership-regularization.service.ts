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

    for (const cycle of allCycles) {
      if (this.buildCycleKey(cycle, frequency) === dto.cycleId) {
        if (cycle.dueDate > currentDate) {
          throw new BadRequestException('No puedes regularizar un ciclo futuro.');
        }
        targetCycle = cycle;
        break;
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
    const discountAmount = dto.overrideAmount !== undefined ? 0 : targetCycle.discountAmount;
    const baseAmount = dto.overrideAmount !== undefined ? dto.overrideAmount : targetCycle.baseAmount;

    const chargePayload = MembershipChargeFactory.buildRecurringChargePayload(
      membershipId,
      baseAmount,
      discountAmount,
      targetCycle.description,
      targetCycle.dueDate,
      targetCycle.billingYear,
      targetCycle.billingMonth,
      targetCycle.billingCycle,
      null,
    );

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
      [TypeMembershipCharge.RECURRING_FEE],
    );
    return new Set(
      existing.map((c) =>
        this.buildCycleKey({
          billingYear: c.billingYear,
          billingMonth: c.billingMonth,
          billingCycle: c.billingCycle,
        }, frequency),
      ),
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




