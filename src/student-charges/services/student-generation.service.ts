import { Injectable, Logger } from '@nestjs/common';
import { Prisma , StatusCourseSeason } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { StudentMembershipWithRelations, calculateRegistrationFee, calculateSinglePaymentFee } from '../student-financial.calculator';
import { formatDiscountsDescription } from '../student-billing.utils';
import { simulateAllCycles, SimulatedCycle } from '../student-cycles.engine';
import { StudentChargeFactory } from '../student-charge.factory';
import { TypeMembershipCharge } from 'src/generated/prisma/client';
import { CycleBatch } from '../interfaces/student-charge.types';
import { DateUtils } from 'src/utils/date.utils';
import { StudentChargeRepository } from '../repositories/student-charge.repository';
import { StudentMembershipRepository } from '../repositories/student-membership.repository';

@Injectable()
export class StudentGenerationService {
  private readonly logger = new Logger(StudentGenerationService.name);

  constructor(
    private readonly membershipRepo: StudentMembershipRepository,
    private readonly chargeRepo: StudentChargeRepository
  ) {}

  public async ensureStudentCharges(
    tx: Prisma.TransactionClient, 
    membership: StudentMembershipWithRelations, 
    evaluationDate: Date
  ) {
    if (!membership.isMigrated) {
      await this.ensureRegistrationCharge(tx, membership);
    }
    await this.ensureRecurringCharges(tx, membership, evaluationDate);
  }

  public async ensureRegistrationCharge(
    tx: Prisma.TransactionClient, 
    membership: StudentMembershipWithRelations
  ) {
    const startYear = membership.startedAt.getUTCFullYear();
    const startMonth = membership.startedAt.getUTCMonth() + 1;
    
    const exists = await this.chargeRepo.checkRegistrationChargeExists(tx, membership.id, startYear, startMonth);
    if (exists) return;

    const { baseAmount, netAmount, appliedDiscounts } = calculateRegistrationFee(membership);
    if (baseAmount <= 0) return;
    
    const description = 'Inscripción' + formatDiscountsDescription(appliedDiscounts);
    await tx.charge.create({
      data: StudentChargeFactory.buildRegistrationChargePayload(
        membership.id, netAmount, description, membership.startedAt
      )
    });
  }

  public async ensureRecurringCharges(
    tx: Prisma.TransactionClient, 
    membership: StudentMembershipWithRelations, 
    evaluationDate: Date
  ) {
    const allCycles = simulateAllCycles(membership);
    const generationDate = this.resolveGenerationPointer(membership, allCycles, evaluationDate);
    let nextPointer: Date | null = generationDate;

    if (!generationDate && membership.isMigrated && membership.nextRecurringChargeGenerationDate !== null) {
       await this.membershipRepo.updateNextGenerationPointer(tx, membership.id, null);
       return;
    }

    const isSeasonFeeOnly = membership.courseSeason.billingConfig?.billingType === 'SINGLE_ONLY' || (membership.courseSeason.billingConfig?.billingType === 'BOTH' && membership.paymentPlan?.isSinglePayment === true);
    const isFullPaymentPlan = membership.paymentPlan?.isSinglePayment === true;

    if (isSeasonFeeOnly) {
        nextPointer = await this.processSinglePaymentGeneration(tx, membership, allCycles);
    } else {
        const billingFrequency = membership.courseSeason.billingConfig?.billingFrequency || 'MONTHLY';
        const existingChargesSet = await this.fetchExistingChargesSet(tx, membership.id, billingFrequency);
        
        // Si es pago completo, generamos todos los ciclos ignorando evaluationDate
        const evalDateToUse = isFullPaymentPlan ? DateUtils.getEndOfUTCDay(membership.courseSeason.season.endDate) : evaluationDate;

        if (generationDate) {
            nextPointer = await this.processRecurringGeneration(tx, membership, allCycles, generationDate, evalDateToUse, existingChargesSet);
        }
    }
    
    await this.membershipRepo.updateNextGenerationPointer(tx, membership.id, nextPointer);
  }

  public async generateAdvanceCharges(
    tx: Prisma.TransactionClient,
    membership: StudentMembershipWithRelations,
    cyclesToGenerate: SimulatedCycle[],
    existingChargesSet?: Set<string>
  ) {
    let lastGeneratedCycle = await this.createRecurringChargesFromCycles(tx, membership, cyclesToGenerate, existingChargesSet);
    
    if (lastGeneratedCycle) {
      const nextPointer = this.calculateNextGenerationPointer(membership, lastGeneratedCycle.nextDueDate);
      await this.membershipRepo.updateNextGenerationPointer(tx, membership.id, nextPointer);
    }
  }

  private async processSinglePaymentGeneration(
    tx: Prisma.TransactionClient, 
    membership: StudentMembershipWithRelations, 
    allCycles: SimulatedCycle[]
  ) {
    if (membership.isMigrated) {
        await this.membershipRepo.updateNextGenerationPointer(tx, membership.id, null);
        return null;
    }

    const startBillingYear = membership.startedAt.getUTCFullYear();
    const startBillingMonth = membership.startedAt.getUTCMonth() + 1;
    
    const exists = await this.chargeRepo.checkSeasonChargeExists(tx, membership.id, startBillingYear, startBillingMonth);

    if (!exists) {
        let singlePaymentBaseAmount = 0;
        let singlePaymentDiscountPercent = 0;
        
        for (const cycle of allCycles) {
            singlePaymentBaseAmount += cycle.baseAmount;
            singlePaymentDiscountPercent = cycle.discountPercent;
        }
        
        const singlePayment = calculateSinglePaymentFee(membership, singlePaymentBaseAmount, singlePaymentDiscountPercent);
        if (singlePayment.hasSinglePaymentAmount) {
            await tx.charge.create({
                data: StudentChargeFactory.buildSeasonChargePayload(
                  membership.id, singlePayment.netAmount, singlePayment.description, membership.startedAt, startBillingYear, startBillingMonth
                )
            });
        }
    }
    return null;
  }

  private async processRecurringGeneration(
    tx: Prisma.TransactionClient, 
    membership: StudentMembershipWithRelations, 
    allCycles: SimulatedCycle[], 
    generationDate: Date, 
    evaluationDate: Date, 
    existingChargesSet: Set<string>
  ): Promise<Date | null> {
    let nextPointer: Date | null = generationDate;
    
    const ungeneratedCycles = allCycles.filter(cycle => !this.isCycleGenerated(cycle, existingChargesSet, membership));
    
    const validStartingCycles = ungeneratedCycles.filter(c => {
       let cycleGenDate = this.calculateNextGenerationPointer(membership, c.dueDate);
       if (cycleGenDate && c.isFirstCycle && !membership.isMigrated) {
           if (cycleGenDate < membership.startedAt) {
               cycleGenDate = new Date(membership.startedAt);
           }
       }
       return cycleGenDate && cycleGenDate <= evaluationDate;
    });

    if (validStartingCycles.length === 0) {
      if (membership.isMigrated || generationDate > membership.startedAt) {
         let tempPointer = new Date(membership.startedAt);
         for (const cycle of allCycles) {
            if (tempPointer >= generationDate) break;
            const cycleGenDate = this.calculateNextGenerationPointer(membership, cycle.dueDate);
            if (cycleGenDate) tempPointer = cycleGenDate;
         }
      }
      return nextPointer;
    }

    let currentIndex = ungeneratedCycles.indexOf(validStartingCycles[0]);
    if (currentIndex === -1) return nextPointer;

    const advanceCycles = Math.max(1, membership.paymentPlan?.advanceCycles || 1);
    const seasonEnd = DateUtils.getEndOfUTCDay(membership.courseSeason.season.endDate);

    while (currentIndex < ungeneratedCycles.length) {
      const cycle = ungeneratedCycles[currentIndex];
      let cycleGenDate = this.calculateNextGenerationPointer(membership, cycle.dueDate);
      if (cycleGenDate && cycle.isFirstCycle && !membership.isMigrated) {
          if (cycleGenDate < membership.startedAt) {
              cycleGenDate = new Date(membership.startedAt);
          }
      }
      
      if (!cycleGenDate || cycleGenDate > evaluationDate) {
        break; 
      }

      const currentBatchAdvanceCycles = cycle.cycleCounter <= advanceCycles ? (advanceCycles - cycle.cycleCounter + 1) : 1;
      const batch = this.chunkCyclesByAdvanceConfiguration(ungeneratedCycles, currentIndex, currentBatchAdvanceCycles, seasonEnd);
      if (batch.cycles.length > 0) {
        await this.createRecurringChargesFromCycles(tx, membership, batch.cycles, existingChargesSet, batch.groupDueDate);
        nextPointer = this.calculateNextGenerationPointer(membership, batch.lastCycleNextDueDate);
      } else {
        nextPointer = null;
      }

      currentIndex += batch.cycles.length > 0 ? batch.cycles.length : 1;
    }

    return nextPointer;
  }

  private chunkCyclesByAdvanceConfiguration(
    ungeneratedCycles: SimulatedCycle[], 
    startIndex: number, 
    advanceCycles: number, 
    seasonEnd: Date
  ): CycleBatch {
    const cycles: SimulatedCycle[] = [];
    const firstCycle = ungeneratedCycles[startIndex];
    
    if (!firstCycle) return { cycles: [], groupDueDate: new Date(), lastCycleNextDueDate: new Date() };
    
    let lastNextDueDate = firstCycle.nextDueDate;

    for (let i = 0; i < advanceCycles; i++) {
       const c = ungeneratedCycles[startIndex + i];
       if (!c) break;
       if (i > 0 && c.dueDate > seasonEnd) break;
       
       cycles.push(c);
       lastNextDueDate = c.nextDueDate;
       if (c.nextDueDate > seasonEnd) break;
    }

    return {
      cycles,
      groupDueDate: firstCycle.dueDate,
      lastCycleNextDueDate: lastNextDueDate
    };
  }

  public async fetchExistingChargesSet(
    tx: Prisma.TransactionClient | PrismaService, 
    membershipId: string, 
    billingFrequency: string
  ): Promise<Set<string>> {
    const existing = await this.chargeRepo.fetchExistingCharges(tx, membershipId, [TypeMembershipCharge.RECURRING_FEE]);
    return new Set(existing.map(c => `${c.billingYear}-${c.billingMonth}-${billingFrequency === 'MONTHLY' ? 'NONE' : c.billingCycle}`));
  }

  public isCycleGenerated(cycle: SimulatedCycle, existingChargesSet: Set<string>, membership: StudentMembershipWithRelations): boolean {
    const freq = membership.courseSeason.billingConfig?.billingFrequency || 'MONTHLY';
    const chargeKey = `${cycle.billingYear}-${cycle.billingMonth}-${freq === 'MONTHLY' ? 'NONE' : cycle.billingCycle}`;
    
    if (existingChargesSet.has(chargeKey)) return true;

    if (membership.isMigrated) {
      const startYear = membership.startedAt.getUTCFullYear();
      const startMonth = membership.startedAt.getUTCMonth() + 1;
      if (cycle.billingYear < startYear || (cycle.billingYear === startYear && cycle.billingMonth <= startMonth)) {
        return true;
      }
    }

    return false;
  }

  public calculateNextGenerationPointer(
    membership: StudentMembershipWithRelations, 
    lastNextDueDate: Date
  ): Date | null {
    const seasonEnd = DateUtils.getEndOfUTCDay(membership.courseSeason.season.endDate);
    if (lastNextDueDate > seasonEnd) return null;
    
    const nextGenerationDate = new Date(lastNextDueDate);
    nextGenerationDate.setUTCDate(nextGenerationDate.getUTCDate() - (membership.courseSeason.billingConfig?.chargeGenerationDaysBefore || 7));
    return nextGenerationDate;
  }



  public resolveGenerationPointer(
    membership: StudentMembershipWithRelations, 
    allCycles: SimulatedCycle[], 
    evaluationDate: Date
  ): Date | null {
    if (membership.nextRecurringChargeGenerationDate) return membership.nextRecurringChargeGenerationDate;
    if (!membership.isMigrated) return new Date(membership.startedAt);
    
    let tempPointer = new Date(membership.startedAt);
    const startYear = membership.startedAt.getUTCFullYear();
    const startMonth = membership.startedAt.getUTCMonth() + 1;
    
    for (const cycle of allCycles) {
      // Para membresías migradas, asumimos que todo el mes actual (el mes de startedAt) y anteriores
      // ya fueron pagados en el sistema anterior. Saltamos estos ciclos.
      const isCycleFromPastOrCurrentMonth = 
        cycle.billingYear < startYear || 
        (cycle.billingYear === startYear && cycle.billingMonth <= startMonth);
      
      if (isCycleFromPastOrCurrentMonth) {
        const nextGenerationDate = this.calculateNextGenerationPointer(membership, cycle.nextDueDate);
        if (!nextGenerationDate) { tempPointer = new Date(0); break; }
        tempPointer = nextGenerationDate;
      } else { 
        break; 
      }
    }
    return tempPointer.getTime() === 0 ? null : tempPointer;
  }

  public async createRecurringChargesFromCycles(
    tx: Prisma.TransactionClient | PrismaService, 
    membership: StudentMembershipWithRelations,
    cycles: SimulatedCycle[],
    existingChargesSet?: Set<string>,
    groupDueDate?: Date
  ): Promise<SimulatedCycle | null> {
    const billingFrequency = membership.courseSeason.billingConfig?.billingFrequency || 'MONTHLY';
    let lastGeneratedCycle: SimulatedCycle | null = null;
    
    for (const cycle of cycles) {
      if (cycle.netAmount >= 0) {
        await tx.charge.create({
          data: StudentChargeFactory.buildRecurringChargePayload(
            membership.id,
            cycle.netAmount,
            cycle.description,
            groupDueDate || cycle.dueDate,
            cycle.billingYear,
            cycle.billingMonth,
            billingFrequency === 'MONTHLY' ? null : cycle.billingCycle
          )
        });
        if (existingChargesSet) {
           existingChargesSet.add(`${cycle.billingYear}-${cycle.billingMonth}-${billingFrequency === 'MONTHLY' ? 'NONE' : cycle.billingCycle}`);
        }
      }
      lastGeneratedCycle = cycle;
    }
    
    return lastGeneratedCycle;
  }

  public async findNextUngeneratedCycles(
    tx: Prisma.TransactionClient | PrismaService,
    membership: StudentMembershipWithRelations,
    quantity: number,
  ): Promise<SimulatedCycle[]> {
    const billingFrequency = membership.courseSeason.billingConfig?.billingFrequency || 'MONTHLY';
    const allCycles = simulateAllCycles(membership);
    const existingChargesSet = await this.fetchExistingChargesSet(tx, membership.id, billingFrequency);

    const nextCycles: SimulatedCycle[] = [];
    for (const cycle of allCycles) {
      if (!this.isCycleGenerated(cycle, existingChargesSet, membership)) {
        nextCycles.push(cycle);
        if (nextCycles.length === quantity) break;
      }
    }

    return nextCycles;
  }
}

