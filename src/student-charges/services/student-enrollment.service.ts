import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StudentMembershipRepository } from '../repositories/student-membership.repository';
import { StudentPreviewService } from './student-preview.service';
import { DateUtils } from 'src/utils/date.utils';
import { Prisma, TypeMembershipCharge, StatusCharge, CycleEnrollmentStatus } from 'src/generated/prisma/client';
import { getAbsoluteSeasonCycles, findCycleContainingDate, calculateEffectiveBillablePeriod, calculateBillableDaysWithPauses, MILLISECONDS_IN_DAY, buildCycleDescription, resolveFinancialEnrollmentOptions } from '../student-billing.utils';
import { calculateOnDemandCycleFee, calculateRegistrationFee, calculateSinglePaymentFee } from '../student-financial.calculator';
import { validateCourseSeasonCapacity } from 'src/common/helpers/capacity.helper';

@Injectable()
export class StudentEnrollmentService {
  private readonly logger = new Logger(StudentEnrollmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepo: StudentMembershipRepository,
  ) {}

  /**
   * FASE 2.6: Inscribe al estudiante en su primer ciclo (o ciclos de adelanto inicial).
   * Reemplaza a la antigua lógica de generación automática para nuevas membresías.
   */
  async enrollInitialCycle(
    membershipId: string,
    options?: {
      chargeRegistration?: boolean;
      chargeInitialCycle?: boolean;
      chargeRegistrationOnMigration?: boolean;
      chargeCurrentMonthOnMigration?: boolean;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const prisma = tx || this.prisma;
    const membership = await this.membershipRepo.getMembershipById(membershipId, tx);
    if (!membership) return;

    const isMigratedContext = membership.isMigrated;
    const { chargeRegistration, chargeInitialCycle } = resolveFinancialEnrollmentOptions(isMigratedContext, options);

    const seasonStartDate = membership.courseSeason.season.startDate;
    const seasonEndDate = membership.courseSeason.season.endDate;
    const billingFrequency = membership.courseSeason.billingConfig?.billingFrequency || 'MONTHLY';
    
    const isSeasonFeeOnly =
      membership.courseSeason.billingConfig?.billingType === 'SINGLE_ONLY' ||
      (membership.courseSeason.billingConfig?.billingType === 'BOTH' &&
        membership.paymentPlan?.isSinglePayment === true);
    
    const isFullPaymentPlan = membership.paymentPlan?.isSinglePayment === true;

    // Obtener todos los ciclos matemáticos (virtuales)
    const allCycles = getAbsoluteSeasonCycles(seasonStartDate, seasonEndDate, billingFrequency);
    
    // 1. Validar que startedAt no sea anterior al inicio de la temporada
    if (membership.startedAt.getTime() < seasonStartDate.getTime()) {
      throw new BadRequestException('La fecha de inicio de la membresía no puede ser anterior al inicio de la temporada.');
    }

    // Resolver ciclos a los que se inscribirá explícitamente
    const cyclesToEnroll = [];
    const fs = require('fs');
    fs.appendFileSync('enrollment-debug.log', `[DEBUG] enrollInitialCycle: isSeasonFeeOnly=${isSeasonFeeOnly}, startedAt=${membership.startedAt}, chargeReg=${chargeRegistration}, chargeInit=${chargeInitialCycle}\n`);
    
    if (isSeasonFeeOnly) {
       const singleCycle = allCycles[0];
       if (singleCycle) {
          cyclesToEnroll.push(singleCycle);
       }
    } else {
       const firstCycle = findCycleContainingDate(allCycles, membership.startedAt);
       if (firstCycle) {
           const advanceCycles = isFullPaymentPlan ? allCycles.length : Math.max(1, membership.paymentPlan?.advanceCycles || 1);
           const cycleIndex = allCycles.findIndex(c => c.cycleCounter === firstCycle.cycleCounter);
           for (let i = 0; i < advanceCycles; i++) {
               const currentCycle = allCycles[cycleIndex + i];
               if (currentCycle) {
                   cyclesToEnroll.push(currentCycle);
               }
           }
       }
    }
    fs.appendFileSync('enrollment-debug.log', `[DEBUG] cyclesToEnroll length: ${cyclesToEnroll.length}\n`);

    // Usamos una transacción para garantizar atomicidad
    try {
      const executeEnrollment = async (db: Prisma.TransactionClient) => {
        // 1. Inscripción (Matrícula)
        let totalRegistrationAmount = 0;
        let registrationDiscount = 0;
        let baseRegistrationAmount = 0;

        if (chargeRegistration) {
           const existingRegistration = await db.studentCharge.findFirst({
               where: { studentMembershipId: membership.id, type: TypeMembershipCharge.REGISTRATION }
           });
           
           if (!existingRegistration) {
               const regFeeCalculation = calculateRegistrationFee(membership);
               if (regFeeCalculation.baseAmount && regFeeCalculation.baseAmount > 0) {
                   baseRegistrationAmount = regFeeCalculation.baseAmount;
                   totalRegistrationAmount = regFeeCalculation.netAmount;
                   registrationDiscount = regFeeCalculation.discountAmount;
                   
                   // Creamos el cargo de matrícula genérico
                   const registrationCharge = await db.charge.create({
                      data: {
                          amount: totalRegistrationAmount,
                          pendingAmount: totalRegistrationAmount,
                          discountAmount: registrationDiscount,
                          description: 'Inscripción',
                          status: totalRegistrationAmount > 0 ? StatusCharge.PENDING : StatusCharge.PAID,
                          dueDate: DateUtils.getEndOfUTCDay(membership.startedAt),
                      }
                   });
                   
                   await db.studentCharge.create({
                      data: {
                          studentMembershipId: membership.id,
                          chargeId: registrationCharge.id,
                          type: TypeMembershipCharge.REGISTRATION,
                      }
                   });
               }
           }
        }

        // 2. Crear los CycleEnrollments y sus Charges
        for (let i = 0; i < cyclesToEnroll.length; i++) {
            const currentCycle = cyclesToEnroll[i];
            
            // Validar que no exista un CycleEnrollment duplicado
            const existingEnrollment = await db.cycleEnrollment.findUnique({
               where: {
                   unique_cycle_enrollment: {
                       studentMembershipId: membership.id,
                       cycleStartDate: currentCycle.cycleStartDate,
                       cycleEndDate: currentCycle.cycleEndDate
                   }
               }
            });
            
            if (existingEnrollment) continue; // Si ya existe, lo ignoramos

            // VALIDAR CAPACIDAD ANTES DE CREAR EL ENROLLMENT
            await validateCourseSeasonCapacity(
              db,
              membership.courseSeasonId,
              currentCycle.cycleStartDate,
              currentCycle.cycleEndDate,
            );

            // Calcular montos y fechas (Recálculo fuerte validando en backend)
            const enrollmentDateForCycle = (i === 0) ? membership.startedAt : currentCycle.cycleStartDate;
            const { effectiveStart, effectiveEnd } = calculateEffectiveBillablePeriod(currentCycle, enrollmentDateForCycle, seasonEndDate);
            
            const fs = require('fs');
            fs.appendFileSync('enrollment-debug.log', `[DEBUG] cycle ${i}: effectiveStart=${effectiveStart}, effectiveEnd=${effectiveEnd}\n`);

            if (effectiveStart >= effectiveEnd) continue; // Fuera de temporada
            
            const allPauses = [
              ...(membership.pauses || []),
              ...(membership.courseSeason.pauses || []),
            ];
            const { billableDays } = calculateBillableDaysWithPauses(effectiveStart, effectiveEnd, allPauses);
            const cycleTotalDays = (currentCycle.cycleEndDate.getTime() - currentCycle.cycleStartDate.getTime()) / MILLISECONDS_IN_DAY;
               
            let finalBillableDays = billableDays;
            if (i === 0 && membership.courseSeason.billingConfig?.prorateFirstRecurringFee === false) {
               const { billableDays: billableDaysWithoutLateEntry } = calculateBillableDaysWithPauses(currentCycle.cycleStartDate, effectiveEnd, allPauses);
               finalBillableDays = billableDaysWithoutLateEntry;
            }

            const isTruncatedEnd = currentCycle.cycleEndDate.getTime() > seasonEndDate.getTime();
            if (isTruncatedEnd && membership.courseSeason.billingConfig?.prorateLastRecurringFee === false) {
               const startForProrating = (i === 0 && membership.courseSeason.billingConfig?.prorateFirstRecurringFee === false) 
                    ? currentCycle.cycleStartDate 
                    : effectiveStart;
               
               const { billableDays: fullCycleBillableDays } = calculateBillableDaysWithPauses(startForProrating, currentCycle.cycleEndDate, allPauses);
               finalBillableDays = fullCycleBillableDays;
            }

            let netAmount = 0, baseAmount = 0, discountAmount = 0, description = 'Cuota regular';

            if (isSeasonFeeOnly) {
               const singlePaymentBaseAmount = Number(membership.courseSeason.billingConfig?.seasonFee || 0);
               const singlePaymentDiscountPercent = (membership.studentDiscounts || []).reduce((acc, d) => acc + Number(d.seasonFeeDiscountPercent || 0), 0);

               const singlePayment = calculateSinglePaymentFee(membership, singlePaymentBaseAmount, singlePaymentDiscountPercent);
               
               if (singlePayment.hasSinglePaymentAmount) {
                  netAmount = singlePayment.netAmount;
                  baseAmount = singlePayment.baseAmount;
                  discountAmount = singlePayment.discountAmount;
                  description = singlePayment.description;
               }
            } else {
               const calc = calculateOnDemandCycleFee(
                  membership,
                  currentCycle,
                  finalBillableDays,
                  cycleTotalDays
               );
               netAmount = calc.netAmount;
               baseAmount = calc.baseAmount;
               discountAmount = calc.discountAmount;
               description = buildCycleDescription(
                  currentCycle.cycleStartDate,
                  currentCycle.cycleEndDate,
                  billingFrequency
               );
               
               if (finalBillableDays < cycleTotalDays) {
                 description += ` — Prorrateado: ${finalBillableDays} de ${cycleTotalDays} días`;
               }
            }

            // 1. Validar si debemos cobrar el ciclo actual (siempre es true excepto para el primer ciclo si chargeInitialCycle = false)
            const shouldChargeCycle = !(i === 0 && !chargeInitialCycle);
            
            let cycleCharge = null;
            if (shouldChargeCycle) {
               cycleCharge = await db.charge.create({
                   data: {
                       amount: netAmount,
                       pendingAmount: netAmount,
                       discountAmount: discountAmount,
                       description: description,
                       status: netAmount > 0 ? StatusCharge.PENDING : StatusCharge.PAID,
                       dueDate: DateUtils.getEndOfUTCDay(currentCycle.cycleStartDate),
                   }
               });
            }

            // 2. Crear el CycleEnrollment y enlazar el Charge
            const enrollment = await db.cycleEnrollment.create({
                data: {
                    studentMembershipId: membership.id,
                    courseSeasonId: membership.courseSeasonId,
                    chargeId: cycleCharge?.id || null, // Relación! Puede ser null
                    cycleStartDate: currentCycle.cycleStartDate,
                    cycleEndDate: currentCycle.cycleEndDate,
                    effectiveStartDate: effectiveStart,
                    status: (netAmount <= 0 || !shouldChargeCycle) ? CycleEnrollmentStatus.CONFIRMED : CycleEnrollmentStatus.PENDING
                }
            });

            // 3. Crear el StudentCharge para compatibilidad y UI actual (HISTORICO REQUERIDO)
            if (shouldChargeCycle && cycleCharge) {
               await db.studentCharge.create({
                   data: {
                       studentMembershipId: membership.id,
                       chargeId: cycleCharge.id,
                       type: isSeasonFeeOnly ? TypeMembershipCharge.SEASON_FEE : TypeMembershipCharge.RECURRING_FEE,
                       billingYear: currentCycle.billingYear,
                       billingMonth: currentCycle.billingMonth,
                       billingCycle: billingFrequency === 'MONTHLY' ? null : currentCycle.billingCycle
                   }
               });
            }
        }
      };

      if (tx) {
        fs.appendFileSync('enrollment-debug.log', '[DEBUG] Executing with existing tx\n');
        await executeEnrollment(tx);
      } else {
        fs.appendFileSync('enrollment-debug.log', '[DEBUG] Executing with new tx\n');
        await this.prisma.$transaction(async (db) => {
          await executeEnrollment(db);
        });
      }
      this.logger.log(`Enrollment On-Demand exitoso para membresía ${membershipId}`);
    } catch (error) {
       this.logger.error(`Error en enrollment On-Demand para membresía ID ${membershipId}:`, error);
       throw error;
    }
  }
}
