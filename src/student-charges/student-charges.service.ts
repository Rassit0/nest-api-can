import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PreviewStudentChargesDto } from './dto/preview-student-charges.dto';
import { CreateManualChargeDto } from './dto/create-manual-charge.dto';
import { CreateMassiveManualChargeDto } from './dto/create-massive-manual-charge.dto';
import { PrismaService } from 'src/prisma.service';
import {
  Prisma,
  SeasonStatus,
  StatusCourseSeason,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';
import { DateUtils } from 'src/utils/date.utils';
import { StudentChargeFactory } from './student-charge.factory';
import { StudentPreviewService } from './services/student-preview.service';
import { StudentGenerationService } from './services/student-generation.service';
import { PreviewMembershipFactory } from './factories/preview-student.factory';
import { StudentMembershipWithRelations } from './student-financial.calculator';
import { StudentMembershipRepository } from './repositories/student-membership.repository';
import { StudentChargeRepository } from './repositories/student-charge.repository';

/**
 * Servicio central orquestador de cargos (charges) para membresías de jugadores.
 * Responsable de coordinar la previsualización, generación diaria (cron),
 * cobros masivos, cobros manuales y cálculos de recalibración (ej. al cambiar de plan).
 */
@Injectable()
export class StudentChargesService {
  private readonly logger = new Logger(StudentChargesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly previewService: StudentPreviewService,
    private readonly generationService: StudentGenerationService,
    private readonly membershipRepo: StudentMembershipRepository,
    private readonly chargeRepo: StudentChargeRepository,
  ) {}

  /**
   * Genera un desglose simulado (preview) de cómo se verán los cargos para una nueva
   * membresía ANTES de ser creada.
   * Valida que la fecha de inicio esté dentro de la temporada y construye un entorno
   * virtual ("mock") de la membresía para calcular matemáticamente las primeras cuotas.
   *
   * @param data Configuraciones como courseSeasonId, paymentPlanId, startDate y descuentos.
   * @returns Estructura IPreviewChargesResponse con cargos y totales.
   */
  async previewCharges(data: PreviewStudentChargesDto) {
    const {
      courseSeasonId,
      paymentPlanId,
      startDate,
      studentDiscounts = [],
      isMigrated,
    } = data;

    const courseSeason =
      await this.membershipRepo.getCourseSeasonOrThrow(courseSeasonId);

    if (
      courseSeason.season.status === SeasonStatus.CANCELLED ||
      courseSeason.season.status === SeasonStatus.FINISHED ||
      courseSeason.status === StatusCourseSeason.CANCELLED ||
      courseSeason.status === StatusCourseSeason.FINISHED
    ) {
      throw new BadRequestException(
        'No se pueden previsualizar cargos de una temporada o equipo inactivo (cancelado o finalizado)',
      );
    }

    const paymentPlan =
      await this.membershipRepo.getPaymentPlanOrThrow(paymentPlanId);

    const mockStartedAt = new Date(startDate);
    const seasonStart = DateUtils.getStartOfUTCDay(courseSeason.season.startDate);
    const seasonEndValidation = DateUtils.getEndOfUTCDay(
      courseSeason.season.endDate,
    );

    if (mockStartedAt < seasonStart || mockStartedAt > seasonEndValidation) {
      throw new BadRequestException(
        'La fecha de inicio debe estar dentro de la duración de la temporada',
      );
    }

    const parsedDiscounts = studentDiscounts.map((d) => ({
      ...d,
      id: 'preview-discount',
      createdAt: new Date(),
      updatedAt: new Date(),
      studentMembershipId: 'preview-id',
      type: 'CUSTOM' as const,
      reason: 'Preview',
      registrationDiscountPercent: new Prisma.Decimal(
        d.registrationDiscountPercent || 0,
      ),
      recurringDiscountPercent: new Prisma.Decimal(
        d.recurringDiscountPercent || 0,
      ),
      seasonFeeDiscountPercent: new Prisma.Decimal(
        d.seasonFeeDiscountPercent || 0,
      ),
      startDate: new Date(d.startDate),
      endDate: d.endDate ? new Date(d.endDate) : null,
    })) as unknown as StudentMembershipWithRelations['studentDiscounts'];

    const mockMembership = PreviewMembershipFactory.createMockMembership(
      mockStartedAt,
      courseSeason,
      paymentPlan,
      parsedDiscounts,
      isMigrated || false,
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
  async applyDailyStudentCharges() {
    this.logger.log('Iniciando proceso diario de cálculo de cargos...');
    const evaluationDate = DateUtils.getEndOfUTCDay(new Date());

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
            await this.generationService.ensureStudentCharges(
              tx,
              membership,
              evaluationDate,
            );
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            this.logger.warn(`Colisión de cargos prevenida (idempotencia) para membresía ID ${membership.id}`);
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

    if (
      membership.courseSeason.season.status === SeasonStatus.CANCELLED ||
      membership.courseSeason.season.status === SeasonStatus.FINISHED ||
      membership.courseSeason.status === StatusCourseSeason.CANCELLED ||
      membership.courseSeason.status === StatusCourseSeason.FINISHED
    ) {
      throw new BadRequestException(
        'No se pueden generar cargos para una temporada o equipo que ha finalizado o fue cancelada',
      );
    }

    if (!membership.nextRecurringChargeGenerationDate) {
      throw new BadRequestException(
        'La membresía no tiene próximas cuotas programadas (fin de temporada o no inicializada)',
      );
    }

    const evaluationDate = DateUtils.getEndOfUTCDay(
      membership.nextRecurringChargeGenerationDate,
    );

    await this.prisma.$transaction(async (tx) => {
      await this.generationService.ensureRecurringCharges(
        tx,
        membership,
        evaluationDate,
      );
    });
    return { message: 'Próxima cuota generada por adelantado exitosamente' };
  }

  /**
   * Evento transaccional ejecutado inmediatamente después de que un jugador
   * compra o inscribe una membresía. Fuerza la creación del cobro inicial
   * (matrícula y primera cuota) en tiempo real.
   */
  async generateChargesForNewMembership(membershipId: string) {
    const membership =
      await this.membershipRepo.getMembershipById(membershipId);
    if (!membership) return;

    const evaluationDate = DateUtils.getEndOfUTCDay(new Date());

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.generationService.ensureStudentCharges(
          tx,
          membership,
          evaluationDate,
        );
      });
      this.logger.log(
        `Cargos generados/actualizados para nueva membresía ${membershipId}`,
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.warn(`Colisión de cargos prevenida (idempotencia) al generar cargos de nueva membresía ${membershipId}`);
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
    const { courseSeasonId, description, amount, dueDate } = dto;
    const due = DateUtils.getEndOfUTCDay(dueDate);

    const courseSeason =
      await this.membershipRepo.getCourseSeasonOrThrow(courseSeasonId);
    if (
      courseSeason.season.status === SeasonStatus.CANCELLED ||
      courseSeason.season.status === SeasonStatus.FINISHED ||
      courseSeason.status === StatusCourseSeason.CANCELLED ||
      courseSeason.status === StatusCourseSeason.FINISHED
    ) {
      throw new BadRequestException(
        'No se pueden generar cargos masivos para una temporada o equipo que ha finalizado o fue cancelada',
      );
    }

    const activeMemberships =
      await this.membershipRepo.getActiveMembershipsIdsBySeason(courseSeasonId);

    if (activeMemberships.length === 0) {
      throw new BadRequestException(
        'No hay miembros activos para generar el cargo.',
      );
    }

    const chargesData: Prisma.ChargeCreateManyInput[] = [];
    const studentChargesData: Prisma.StudentChargeCreateManyInput[] = [];

    for (const membership of activeMemberships) {
      const chargeId = randomUUID();
      const payload = StudentChargeFactory.buildManualChargePayload(
        membership.id,
        amount,
        description,
        due,
      );

      const chargeFields = { ...payload };
      delete chargeFields.studentCharges;

      chargesData.push({
        id: chargeId,
        ...chargeFields,
      } as Prisma.ChargeCreateManyInput);

      const mcCreate = payload.studentCharges?.create;
      if (mcCreate && !Array.isArray(mcCreate)) {
        studentChargesData.push({
          chargeId,
          ...mcCreate,
        } as Prisma.StudentChargeCreateManyInput);
      }
    }

    const chunkSize = 1000;

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < chargesData.length; i += chunkSize) {
        const chargesChunk = chargesData.slice(i, i + chunkSize);
        await this.chargeRepo.bulkCreateCharges(tx, chargesChunk);
      }

      for (let i = 0; i < studentChargesData.length; i += chunkSize) {
        const studentChargesChunk = studentChargesData.slice(
          i,
          i + chunkSize,
        );
        await this.chargeRepo.bulkCreateStudentCharges(
          tx,
          studentChargesChunk,
        );
      }
    });

    return {
      message: `Cargos generados exitosamente para ${activeMemberships.length} miembros.`,
    };
  }

  /**
   * Crea un cargo extraordinario manual para un único jugador específico.
   */
  async createManualCharge(dto: CreateManualChargeDto) {
    const membership = await this.membershipRepo.getMembershipOrThrow(
      dto.membershipId,
    );

    if (
      membership.courseSeason.season.status === SeasonStatus.CANCELLED ||
      membership.courseSeason.season.status === SeasonStatus.FINISHED ||
      membership.courseSeason.status === StatusCourseSeason.CANCELLED ||
      membership.courseSeason.status === StatusCourseSeason.FINISHED
    ) {
      throw new BadRequestException(
        'No se pueden generar cargos manuales para una temporada o equipo que ha finalizado o fue cancelada',
      );
    }

    const dueDate = DateUtils.getStartOfUTCDay(dto.dueDate);

    await this.prisma.$transaction(async (tx) => {
      await tx.charge.create({
        data: StudentChargeFactory.buildManualChargePayload(
          membership.id,
          dto.amount,
          dto.description,
          dueDate,
        ),
      });
    });

    return { message: 'Cargo manual creado exitosamente' };
  }

  /**
   * Módulo de Autorreparación/Recalibración de Cargos.
   * Invocado cuando ocurre un cambio mutacional (ej: Se le cambia el PaymentPlan al usuario).
   *
   * Lógica crítica:
   * 1. Descubre todos los cargos recurrentes pendientes a futuro.
   * 2. (PROTECCIÓN FINANCIERA): Solo selecciona aquellos donde (PendingAmount === Amount).
   *    Si el usuario ya pagó $1 de una cuota de $100, la cuota está bloqueada y NO se borra.
   * 3. Borra las cuotas elegibles.
   * 4. Retrasa el 'nextRecurringChargeGenerationDate' para simular que retrocedimos en el tiempo.
   * 5. Fuerza un recalculo para que nazcan nuevas cuotas con los beneficios del nuevo plan.
   */
  async recalculatePendingFutureCharges(studentMembershipId: string) {
    // 1. Tomamos el momento actual como base para buscar cargos futuros
    const evaluationDate = DateUtils.getStartOfUTCDay(new Date());

    const pendingStudentCharges =
      await this.chargeRepo.fetchPendingFutureStudentCharges(
        studentMembershipId,
        evaluationDate,
      );
    if (pendingStudentCharges.length === 0) return;

    // 2. Filtro estricto: Solo tocamos cuotas que no tengan pagos parciales (pendingAmount === amount)
    const fullyPendingChargeIds = pendingStudentCharges
      .filter(
        (mc) => Number(mc.charge.pendingAmount) === Number(mc.charge.amount),
      )
      .map((mc) => mc.chargeId);

    if (fullyPendingChargeIds.length === 0) return;

    const membership =
      await this.membershipRepo.getMembershipById(studentMembershipId);
    
    // Filtramos cuáles de los cargos eliminables son cuotas recurrentes
    const recurringCharges = pendingStudentCharges.filter(
      (mc) =>
        fullyPendingChargeIds.includes(mc.chargeId) &&
        mc.type === TypeMembershipCharge.RECURRING_FEE,
    );

    let resetDate = membership?.nextRecurringChargeGenerationDate || null;
    let oldNextDate = membership?.nextRecurringChargeGenerationDate || null;

    // 3. Retrocedemos el reloj (nextRecurringChargeGenerationDate) basándonos en el cargo más antiguo que vamos a borrar
    if (recurringCharges.length > 0 && membership?.courseSeason) {
      const earliestDueDate = new Date(
        Math.min(...recurringCharges.map((mc) => mc.charge.dueDate.getTime())),
      );
      
      // Ajustamos la fecha restando los días de anticipación de cobro configurados
      const calculatedResetDate = new Date(earliestDueDate);
      calculatedResetDate.setUTCDate(
        calculatedResetDate.getUTCDate() -
          (membership.courseSeason.billingConfig?.chargeGenerationDaysBefore ??
            0),
      );
      
      // Solo retrocedemos si la fecha calculada es anterior a la actual
      if (!resetDate || calculatedResetDate < resetDate) {
        resetDate = calculatedResetDate;
      }
    }

    // 4. Eliminación física de los cargos obsoletos e inmaculados
    await this.prisma.$transaction(async (tx) => {
      await this.chargeRepo.deletePendingCharges(tx, fullyPendingChargeIds);

      // Guardamos el nuevo puntero de generación de tiempo si hubo cambios
      if (
        membership &&
        resetDate &&
        resetDate.getTime() !== oldNextDate?.getTime()
      ) {
        await this.membershipRepo.updateNextGenerationPointer(
          tx,
          studentMembershipId,
          resetDate,
        );
      }
    });

    // 5. Autosanación: Simulamos que es de noche para forzar la regeneración inmediata de los cargos
    try {
      if (membership) {
        const fakeToday = DateUtils.getEndOfUTCDay(new Date());
        const fullMembership =
          await this.membershipRepo.getMembershipById(studentMembershipId);
          
        if (fullMembership) {
          await this.prisma.$transaction(async (tx) => {
            await this.generationService.ensureStudentCharges(
              tx,
              fullMembership,
              fakeToday,
            );
          });
        }
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo regenerar los cargos tras recálculo para ${studentMembershipId}: ${error.message}`,
      );
    }
  }

  /**
   * Simula N ciclos hacia adelante sin guardarlos en la base de datos.
   * Util para mostrarle al usuario un preview de "Pagar 3 cuotas por adelantado".
   */
  async previewAdvanceCharges(membershipId: string, quantity: number) {
    const membership =
      await this.membershipRepo.getMembershipOrThrow(membershipId);

    if (
      membership.courseSeason.season.status === SeasonStatus.CANCELLED ||
      membership.courseSeason.season.status === SeasonStatus.FINISHED ||
      membership.courseSeason.status === StatusCourseSeason.CANCELLED ||
      membership.courseSeason.status === StatusCourseSeason.FINISHED
    ) {
      throw new BadRequestException(
        'No se pueden previsualizar cuotas adelantadas para una temporada o equipo inactivo',
      );
    }

    const nextCycles = await this.generationService.findNextUngeneratedCycles(
      this.prisma,
      membership,
      quantity,
    );

    if (nextCycles.length === 0) {
      return {
        charges: [],
        breakdown: this.previewService.buildChargesBreakdown([]),
      };
    }

    return this.previewService.extractAdvanceChargesFromCycles(nextCycles);
  }

  /**
   * Concreta la generación física (persistida) de N cuotas por adelantado
   * bajo el contexto de un solo agrupamiento transaccional.
   */
  async generateAdvanceCharges(membershipId: string, quantity: number) {
    const membership =
      await this.membershipRepo.getMembershipOrThrow(membershipId);

    if (
      membership.courseSeason.season.status === SeasonStatus.CANCELLED ||
      membership.courseSeason.season.status === SeasonStatus.FINISHED ||
      membership.courseSeason.status === StatusCourseSeason.CANCELLED ||
      membership.courseSeason.status === StatusCourseSeason.FINISHED
    ) {
      throw new BadRequestException(
        'No se pueden generar cuotas adelantadas para una temporada o equipo inactivo',
      );
    }

    const nextCycles = await this.generationService.findNextUngeneratedCycles(
      this.prisma,
      membership,
      quantity,
    );

    if (nextCycles.length === 0) {
      return {
        message: 'No hay más cuotas disponibles para generar en la temporada.',
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await this.generationService.generateAdvanceCharges(
        tx,
        membership,
        nextCycles,
      );
    });

    return {
      message: `Se generaron exitosamente ${nextCycles.length} cuotas por adelantado.`,
    };
  }
}



