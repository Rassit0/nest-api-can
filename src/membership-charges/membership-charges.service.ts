import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PreviewMembershipChargesDto } from './dto/preview-membership-charges.dto';
import { CreateManualChargeDto } from './dto/create-manual-charge.dto';
import { CreateMassiveManualChargeDto } from './dto/create-massive-manual-charge.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma, TypeMembershipCharge } from 'src/generated/prisma/client';
import { DateUtils } from 'src/utils/date.utils';
import { MembershipPreviewService } from './services/membership-preview.service';
import { MembershipGenerationService } from './services/membership-generation.service';
import { PreviewMembershipFactory } from './factories/preview-membership.factory';
import { MembershipRepository } from './repositories/membership.repository';
import { MembershipChargeRepository } from './repositories/membership-charge.repository';
import { MembershipTeamSeasonValidator } from './validators/membership-team-season.validator';
import { PrismaErrorUtils } from 'src/utils/prisma-error.util';
import { MembershipChargeRecalculationService } from './services/membership-recalculation.service';
import { MembershipManualChargeService } from './services/membership-manual-charge.service';
import { MembershipAdvanceChargeService } from './services/membership-advance-charge.service';

/**
 * Servicio central orquestador de cargos (charges) para membresías de jugadores.
 * Responsable de coordinar la previsualización, generación diaria (cron),
 * cobros masivos, cobros manuales y cálculos de recalibración (ej. al cambiar de plan).
 */
@Injectable()
export class MembershipChargesService {
  private readonly logger = new Logger(MembershipChargesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly previewService: MembershipPreviewService,
    private readonly generationService: MembershipGenerationService,
    private readonly membershipRepo: MembershipRepository,
    private readonly chargeRepo: MembershipChargeRepository,
    private readonly recalculationService: MembershipChargeRecalculationService,
    private readonly manualChargeService: MembershipManualChargeService,
    private readonly advanceChargeService: MembershipAdvanceChargeService,
  ) {}

  /**
   * Genera un desglose simulado (preview) de cómo se verán los cargos para una nueva
   * membresía ANTES de ser creada.
   * Valida que la fecha de inicio esté dentro de la temporada y construye un entorno
   * virtual ("mock") de la membresía para calcular matemáticamente las primeras cuotas.
   *
   * @param data Configuraciones como teamSeasonId, paymentPlanId, startDate y descuentos.
   * @returns Estructura IPreviewChargesResponse con cargos y totales.
   */
  async previewCharges(data: PreviewMembershipChargesDto) {
    const {
      teamSeasonId,
      paymentPlanId,
      startDate,
      membershipDiscounts = [],
      isMigrated,
    } = data;

    const teamSeason =
      await this.membershipRepo.getTeamSeasonOrThrow(teamSeasonId);

    MembershipTeamSeasonValidator.assertIsActive(
      teamSeason,
      'No se pueden previsualizar cargos de una temporada o equipo inactivo (cancelado o finalizado)',
    );

    const paymentPlan =
      await this.membershipRepo.getPaymentPlanOrThrow(paymentPlanId);

    const mockStartedAt = new Date(startDate);
    const seasonStart = DateUtils.getStartOfUTCDay(teamSeason.season.startDate);
    const seasonEndValidation = DateUtils.getEndOfUTCDay(
      teamSeason.season.endDate,
    );

    MembershipTeamSeasonValidator.assertDateWithinSeason(
      mockStartedAt,
      seasonStart,
      seasonEndValidation,
    );

    const parsedDiscounts =
      PreviewMembershipFactory.parseDiscounts(membershipDiscounts);

    const mockMembership = PreviewMembershipFactory.createMockMembership(
      mockStartedAt,
      teamSeason,
      paymentPlan,
      parsedDiscounts,
      isMigrated || false,
      data.chargeRegistrationOnMigration,
      data.chargeCurrentMonthOnMigration,
    );

    return this.previewService.extractPreviewChargesFromCycles(
      mockMembership,
      null,
    );
  }

  /**
   * Extrae y formatea los cargos reales que ya están almacenados en la base de datos
   * para una membresía existente. Usado cuando un administrador visualiza el drawer
   * de una membresía activa y requiere ver lo que el sistema ya calculó.
   *
   * @param membershipId ID real de la membresía.
   */
  async previewExistingCharges(membershipId: string) {
    const membership =
      await this.membershipRepo.getMembershipOrThrow(membershipId);
    const existingCharges = await this.chargeRepo.fetchExistingCharges(
      this.prisma,
      membershipId,
      [
        TypeMembershipCharge.REGISTRATION,
        TypeMembershipCharge.SEASON_FEE,
        TypeMembershipCharge.RECURRING_FEE,
      ],
    );

    return this.previewService.extractPreviewChargesFromCycles(
      membership,
      existingCharges,
    );
  }

  /**
   * [PROCESO CRON DIARIO]
   * Orquesta la evaluación masiva de todas las membresías activas del sistema.
   * Se procesa en bloques (chunks) para cuidar la memoria RAM y envolviendo
   * en transacciones iterativas para asegurar atomicidad sin bloquear toda la DB.
   */
  async applyDailyMembershipCharges() {
    this.logger.log('Iniciando proceso diario de cálculo de cargos...');
    const evaluationDate = DateUtils.getEndOfLocalDayInUTC(new Date());

    const memberships =
      await this.membershipRepo.getMembershipsForDailyGeneration(
        evaluationDate,
      );
    this.logger.log(
      `Se encontraron ${memberships.length} membresías activas o pendientes.`,
    );

    const chunkSize = 50;
    for (let i = 0; i < memberships.length; i += chunkSize) {
      const chunk = memberships.slice(i, i + chunkSize);
      for (const membership of chunk) {
        try {
          await this.prisma.$transaction(async (tx) => {
            await this.generationService.ensureMembershipCharges(
              tx,
              membership,
              evaluationDate,
            );
          });
        } catch (error) {
          if (PrismaErrorUtils.isUniqueConstraintViolation(error)) {
            this.logger.warn(
              `Colisión de cargos prevenida (idempotencia) para membresía ID ${membership.id}`,
            );
          } else {
            this.logger.error(
              `Error procesando cargos para la membresía ID ${membership.id}:`,
              error,
            );
          }
        }
      }
    }

    this.logger.log('Proceso de cargos finalizado.');
  }

  /**
   * Fuerza matemáticamente la generación del siguiente ciclo de cobro disponible,
   * sin importar si aún no se ha cumplido la fecha límite de generación.
   * Util para administradores que requieren facturar por adelantado manualmente.
   */
  async generateNextChargeManually(membershipId: string) {
    const membership =
      await this.membershipRepo.getMembershipOrThrow(membershipId);

    MembershipTeamSeasonValidator.assertIsActive(
      membership.teamSeason,
      'No se pueden generar cargos para una temporada o equipo que ha finalizado o fue cancelada',
    );

    if (!membership.nextRecurringChargeGenerationDate) {
      throw new BadRequestException(
        'La membresía no tiene próximas cuotas programadas (fin de temporada o no inicializada)',
      );
    }

    const evaluationDate = DateUtils.getEndOfUTCDay(
      membership.nextRecurringChargeGenerationDate,
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.generationService.ensureRecurringCharges(
          tx,
          membership,
          evaluationDate,
        );
      });
      return { message: 'Próxima cuota generada por adelantado exitosamente' };
    } catch (error) {
      if (PrismaErrorUtils.isUniqueConstraintViolation(error)) {
        throw new BadRequestException(
          'La cuota que intentas generar ya fue creada recientemente por otro proceso.',
        );
      }
      throw error;
    }
  }

  /**
   * Evento transaccional ejecutado inmediatamente después de que un jugador
   * compra o inscribe una membresía. Fuerza la creación del cobro inicial
   * (matrícula y primera cuota) en tiempo real.
   */
  async generateChargesForNewMembership(
    membershipId: string,
    options?: {
      chargeRegistrationOnMigration?: boolean;
      chargeCurrentMonthOnMigration?: boolean;
    },
  ) {
    const membership =
      await this.membershipRepo.getMembershipById(membershipId);
    if (!membership) return;
    if (!membership.teamSeason.billingConfig?.isEngineActive) return;

    const generationMembership = {
      ...membership,
      chargeRegistrationOnMigration:
        options?.chargeRegistrationOnMigration ??
        membership.chargeRegistrationOnMigration,
      chargeCurrentMonthOnMigration:
        options?.chargeCurrentMonthOnMigration ??
        membership.chargeCurrentMonthOnMigration,
    } as typeof membership;

    const evaluationDate = DateUtils.getEndOfUTCDay(new Date());

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.generationService.ensureMembershipCharges(
          tx,
          generationMembership,
          evaluationDate,
        );
      });
      this.logger.log(
        `Cargos generados/actualizados para nueva membresía ${membershipId}`,
      );
    } catch (error) {
      if (PrismaErrorUtils.isUniqueConstraintViolation(error)) {
        this.logger.warn(
          `Colisión de cargos prevenida (idempotencia) al generar cargos de nueva membresía ${membershipId}`,
        );
      } else {
        this.logger.error(
          `Error generando cargos para nueva membresía ID ${membershipId}:`,
          error,
        );
      }
    }
  }

  /**
   * Aplica un cargo extraordinario (Multa, uniforme, extra) a todos los miembros
   * activos de una temporada. Emplea un mecanismo altamente optimizado usando
   * inserciones masivas (createMany) fraccionadas, permitiendo operar
   * miles de usuarios instantáneamente.
   */
  async createMassiveManualCharge(dto: CreateMassiveManualChargeDto) {
    return this.manualChargeService.createMassiveManualCharge(dto);
  }

  /**
   * Crea un cargo extraordinario manual para un único jugador específico.
   */
  async createManualCharge(dto: CreateManualChargeDto) {
    return this.manualChargeService.createManualCharge(dto);
  }

  /**
   * Módulo de Autorreparación/Recalibración de Cargos.
   * Invocado cuando ocurre un cambio mutacional (ej: Se le cambia el PaymentPlan al usuario).
   *
   * Lógica crítica:
   * 1. Descubre todos los cargos recurrentes pendientes a futuro.
   * 2. (PROTECCIÓN FINANCIERA): Solo selecciona aquellos donde (PendingAmount === Amount).
   * 3. Borra las cuotas elegibles.
   * 4. Retrasa el 'nextRecurringChargeGenerationDate' para simular que retrocedimos en el tiempo.
   * 5. Fuerza un recalculo para que nazcan nuevas cuotas con los beneficios del nuevo plan.
   */
  async recalculatePendingFutureCharges(playerMembershipId: string) {
    return this.recalculationService.recalculatePendingFutureCharges(
      playerMembershipId,
    );
  }

  /**
   * Simula N ciclos hacia adelante sin guardarlos en la base de datos.
   * Util para mostrarle al usuario un preview de "Pagar 3 cuotas por adelantado".
   */
  async previewAdvanceCharges(membershipId: string, quantity: number) {
    return this.advanceChargeService.previewAdvanceCharges(
      membershipId,
      quantity,
    );
  }

  /**
   * Concreta la generación física (persistida) de N cuotas por adelantado
   * bajo el contexto de un solo agrupamiento transaccional.
   */
  async generateAdvanceCharges(membershipId: string, quantity: number) {
    return this.advanceChargeService.generateAdvanceCharges(
      membershipId,
      quantity,
    );
  }
}
