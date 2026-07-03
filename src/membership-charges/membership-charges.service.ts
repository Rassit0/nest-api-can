import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateMembershipChargeDto } from './dto/create-membership-charge.dto';
import { UpdateMembershipChargeDto } from './dto/update-membership-charge.dto';
import { PreviewMembershipChargesDto } from './dto/preview-membership-charges.dto';
import { PrismaService } from 'src/prisma.service';
import {
  Charge,
  PlayerMembershipStatus,
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';

type PlayerMembershipWithRelations = Prisma.PlayerMembershipGetPayload<{
  include: {
    paymentPlan: true;
    membershipDiscounts: true;
    teamSeason: {
      include: {
        season: true;
      };
    };
  };
}>;

const playerMembershipInclude = {
  paymentPlan: true,
  membershipDiscounts: true,
  teamSeason: {
    include: {
      season: true,
    },
  },
} as const;

@Injectable()
export class MembershipChargesService {
  private readonly logger = new Logger(MembershipChargesService.name);

  private readonly MONTH_NAMES = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  constructor(private readonly prisma: PrismaService) {}

  // Previsualizar cargos a generar para una nueva membresía
  async previewCharges(data: PreviewMembershipChargesDto) {
    const { teamSeasonId, paymentPlanId, startDate, membershipDiscounts = [], isMigrated } = data;

    // 1. Obtener la temporada y el plan de pago
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id: teamSeasonId },
      include: { season: true },
    });

    if (!teamSeason) {
      throw new BadRequestException('Temporada de equipo no encontrada');
    }

    const paymentPlan = await this.prisma.paymentPlan.findUnique({
      where: { id: paymentPlanId },
    });

    if (!paymentPlan) {
      throw new BadRequestException('Plan de pago no encontrado');
    }

    // 2. Construir una membresía "falsa" para usar los métodos de cálculo existentes
    const mockStartedAt = new Date(startDate);
    
    // Validar que la fecha de inicio esté dentro del rango de la temporada
    const seasonStart = new Date(teamSeason.season.startDate);
    seasonStart.setUTCHours(0, 0, 0, 0);
    const seasonEndValidation = new Date(teamSeason.season.endDate);
    seasonEndValidation.setUTCHours(23, 59, 59, 999);

    if (mockStartedAt < seasonStart || mockStartedAt > seasonEndValidation) {
      throw new BadRequestException(
        'La fecha de inicio debe estar dentro de la duración de la temporada',
      );
    }

    const parsedDiscounts = membershipDiscounts.map((d) => ({
      ...d,
      startDate: new Date(d.startDate),
      endDate: d.endDate ? new Date(d.endDate) : null,
    }));

    const mockMembership = {
      startedAt: mockStartedAt,
      teamSeason,
      paymentPlan,
      membershipDiscounts: parsedDiscounts,
      isMigrated: isMigrated || false,
    } as unknown as PlayerMembershipWithRelations;

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

    // 3. Simular cargo de inscripción
    if (!isMigrated) {
      const { netAmount: registrationAmount, baseAmount, discountAmount, discountPercent } = this.calculateRegistrationFee(mockMembership);
      if (baseAmount && baseAmount > 0) {
        chargesToGenerate.push({
          type: TypeMembershipCharge.REGISTRATION,
          description: 'Inscripción',
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

    // 4. Simular cargos mensuales hasta el fin de la temporada
    const seasonEnd = new Date(teamSeason.season.endDate);
    seasonEnd.setUTCHours(23, 59, 59, 999);

    const billingDay = Number(teamSeason.billingDay);

    let currentBillingYear = mockMembership.startedAt.getUTCFullYear();
    let currentBillingMonth = mockMembership.startedAt.getUTCMonth() + 1;
    let keepGenerating = true;

    // Si es migrado, los cargos iniciales no se generan hoy, se delegan enteramente al CRON futuro.
    // Por lo tanto, no mostramos cuotas mensuales a pagar en el momento de la inscripción.
    if (isMigrated) {
      keepGenerating = false;
    }

    // Límite de seguridad para evitar ciclos infinitos (ej. máx 120 meses / 10 años)
    let safetyCounter = 0;

    while (keepGenerating && safetyCounter < 120) {
      safetyCounter++;

      const billingYear = currentBillingYear;
      const billingMonth = currentBillingMonth;

      const maxDaysInCurrentMonth = new Date(Date.UTC(billingYear, billingMonth, 0)).getUTCDate();
      const safeCurrentBillingDay = Math.min(billingDay, maxDaysInCurrentMonth);
      const dueDate = new Date(Date.UTC(billingYear, billingMonth - 1, safeCurrentBillingDay));

      let nextYear = billingYear;
      let nextMonth = billingMonth + 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      const maxDaysInNextMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
      const safeNextBillingDay = Math.min(billingDay, maxDaysInNextMonth);
      const nextDueDate = new Date(Date.UTC(nextYear, nextMonth - 1, safeNextBillingDay));

      const isFirstMonth =
        billingYear === mockMembership.startedAt.getUTCFullYear() &&
        billingMonth - 1 === mockMembership.startedAt.getUTCMonth();

      let description = this.buildMonthlyDescription(mockMembership, billingYear, billingMonth);

      if (isFirstMonth && nextDueDate) {
        const cycleDays = Math.round(
          (nextDueDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const activeDays = Math.max(
          0,
          Math.round(
            (nextDueDate.getTime() - mockMembership.startedAt.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );

        if (activeDays > 0 && activeDays !== cycleDays) {
          description += ` (Prorrateo por ${activeDays} días)`;
        }
      }

      const { netAmount: amount, baseAmount, discountAmount, discountPercent } = this.calculateMonthlyFeeForDate(
        mockMembership,
        dueDate,
        isFirstMonth,
        nextDueDate,
      );

      if (baseAmount && baseAmount > 0) {
        chargesToGenerate.push({
          type: TypeMembershipCharge.MONTHLY_FEE,
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

      // Al ser previsualización inicial, solo mostramos el primer mes a cobrar
      break;
    }

    const totalBaseAmount = chargesToGenerate.reduce((sum, c) => sum + (c.baseAmount || 0), 0);
    const totalDiscountAmount = chargesToGenerate.reduce((sum, c) => sum + (c.discountAmount || 0), 0);
    const totalNetAmount = chargesToGenerate.reduce((sum, c) => sum + c.amount, 0);

    return {
      charges: chargesToGenerate,
      breakdown: {
        totalBaseAmount,
        totalDiscount: totalDiscountAmount,
        totalNetAmount,
        currency: 'BOB', // Puedes ajustar la moneda si es necesario
      }
    };
  }

  // Previsualizar cargos restantes para una membresía existente
  async previewExistingCharges(membershipId: string) {
    // 1. Obtener la membresía con sus relaciones
    const membership = await this.prisma.playerMembership.findUnique({
      where: { id: membershipId },
      include: playerMembershipInclude,
    });

    if (!membership) {
      throw new BadRequestException('Membresía no encontrada');
    }

    // Obtener los cargos que ya han sido generados para esta membresía
    const existingCharges = await this.prisma.membershipCharge.findMany({
      where: { playerMembershipId: membershipId },
      select: { type: true, billingYear: true, billingMonth: true },
    });

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

    // 2. Simular cargo de inscripción si no existe
    const hasRegistration = existingCharges.some((c) => c.type === TypeMembershipCharge.REGISTRATION);
    if (!hasRegistration) {
      const { netAmount: registrationAmount, baseAmount, discountAmount, discountPercent } = this.calculateRegistrationFee(membership);
      if (baseAmount && baseAmount > 0) {
        chargesToGenerate.push({
          type: TypeMembershipCharge.REGISTRATION,
          description: 'Inscripción',
          amount: registrationAmount,
          dueDate: membership.startedAt,
          billingYear: membership.startedAt.getUTCFullYear(),
          billingMonth: membership.startedAt.getUTCMonth() + 1,
          ...({ baseAmount, discountAmount, discountPercent })
        });
      }
    }

    // 3. Simular cargos mensuales hasta el fin de la temporada
    const seasonEnd = new Date(membership.teamSeason.season.endDate);
    seasonEnd.setUTCHours(23, 59, 59, 999);

    const billingDay = Number(membership.teamSeason.billingDay);

    let currentBillingYear = membership.startedAt.getUTCFullYear();
    let currentBillingMonth = membership.startedAt.getUTCMonth() + 1;
    let keepGenerating = true;

    // Límite de seguridad para evitar ciclos infinitos (ej. máx 120 meses / 10 años)
    let safetyCounter = 0;

    while (keepGenerating && safetyCounter < 120) {
      safetyCounter++;

      const billingYear = currentBillingYear;
      const billingMonth = currentBillingMonth;

      const maxDaysInCurrentMonth = new Date(Date.UTC(billingYear, billingMonth, 0)).getUTCDate();
      const safeCurrentBillingDay = Math.min(billingDay, maxDaysInCurrentMonth);
      const dueDate = new Date(Date.UTC(billingYear, billingMonth - 1, safeCurrentBillingDay));

      let nextYear = billingYear;
      let nextMonth = billingMonth + 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      const maxDaysInNextMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
      const safeNextBillingDay = Math.min(billingDay, maxDaysInNextMonth);
      const nextDueDate = new Date(Date.UTC(nextYear, nextMonth - 1, safeNextBillingDay));

      const isFirstMonth =
        billingYear === membership.startedAt.getUTCFullYear() &&
        billingMonth - 1 === membership.startedAt.getUTCMonth();

      let description = this.buildMonthlyDescription(membership, billingYear, billingMonth);

      if (isFirstMonth && nextDueDate) {
        const cycleDays = Math.round(
          (nextDueDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const activeDays = Math.max(
          0,
          Math.round(
            (nextDueDate.getTime() - membership.startedAt.getTime()) / (1000 * 60 * 60 * 24),
          ),
        );

        if (activeDays > 0 && activeDays !== cycleDays) {
          description += ` (Prorrateo por ${activeDays} días)`;
        }
      }

      // Verificamos si este mes/año ya fue generado previamente en la DB
      const hasMonthly = existingCharges.some(
        (c) =>
          c.type === TypeMembershipCharge.MONTHLY_FEE &&
          c.billingYear === billingYear &&
          c.billingMonth === billingMonth,
      );

      // Solo lo agregamos a la previsualización si NO existe
      if (!hasMonthly) {
        const { netAmount: amount, baseAmount, discountAmount, discountPercent } = this.calculateMonthlyFeeForDate(membership, dueDate, isFirstMonth, nextDueDate);

        if (baseAmount && baseAmount > 0) {
          chargesToGenerate.push({
            type: TypeMembershipCharge.MONTHLY_FEE,
            description,
            amount,
            dueDate,
            billingYear,
            billingMonth,
            ...({ baseAmount, discountAmount, discountPercent })
          });
        }
        
        // Solo previsualizamos el próximo mes correspondiente
        break;
      }

      // Si el vencimiento del siguiente mes ya supera el fin de temporada, paramos
      if (nextDueDate > seasonEnd) {
        keepGenerating = false;
        break;
      }

      currentBillingYear = nextYear;
      currentBillingMonth = nextMonth;
    }
    const totalBaseAmount = chargesToGenerate.reduce((sum, c) => sum + (c.baseAmount || 0), 0);
    const totalDiscountAmount = chargesToGenerate.reduce((sum, c) => sum + (c.discountAmount || 0), 0);
    const totalNetAmount = chargesToGenerate.reduce((sum, c) => sum + c.amount, 0);

    return {
      charges: chargesToGenerate,
      breakdown: {
        totalBaseAmount,
        totalDiscount: totalDiscountAmount,
        totalNetAmount,
        currency: 'BOB',
      }
    };
  }

  // Aplicar cargos mensuales
  async applyDailyMembershipCharges() {
    this.logger.log('Iniciando proceso diario de cálculo de cargos...');

    // Obtener la fecha actual con la hora establecida a las 23:59:59.999 para que se procesen todos los cargos del día
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    // Obtener todas las membresías activas
    const memberships = await this.prisma.playerMembership.findMany({
      where: {
        status: {
          in: [
            PlayerMembershipStatus.ACTIVE,
            PlayerMembershipStatus.PENDING_ACTIVE,
            PlayerMembershipStatus.SUSPENDED,
          ],
        },
        OR: [
          {
            nextMonthlyChargeGenerationDate: {
              lte: today,
            },
          },
          {
            nextMonthlyChargeGenerationDate: null,
          },
        ],
        // Obtener todas las membresías que tengan una fecha de fin de temporada mayor o igual a la fecha actual
        teamSeason: {
          season: {
            endDate: {
              gte: today,
            },
          },
        },
      },
      include: playerMembershipInclude,
    });

    this.logger.log(
      `Se encontraron ${memberships.length} membresías activas o pendientes.`,
    );

    // 2. Iterar en cada membresía
    for (const membership of memberships) {
      try {
        // Iniciar una transacción para cada membresía
        await this.prisma.$transaction(async (tx) => {
          // Asegurar que los cargos de la membresía estén actualizados
          await this.ensureMembershipCharges(tx, membership, today);
        });
      } catch (error) {
        this.logger.error(
          `Error procesando cargos para la membresía ID ${membership.id}:`,
          error,
        );
      }
    }

    this.logger.log('Proceso de cargos finalizado.');
  }

  // Generar la próxima cuota manualmente (Adelanto a demanda)
  async generateNextChargeManually(membershipId: string) {
    const membership = await this.prisma.playerMembership.findUnique({
      where: { id: membershipId },
      include: playerMembershipInclude,
    });

    if (!membership) {
      throw new BadRequestException('Membresía no encontrada');
    }

    if (!membership.nextMonthlyChargeGenerationDate) {
      throw new BadRequestException('La membresía no tiene próximas cuotas programadas (fin de temporada o no inicializada)');
    }

    // Simulamos que "hoy" es el día en que tocaba generar ese cargo
    const fakeToday = new Date(membership.nextMonthlyChargeGenerationDate);
    fakeToday.setUTCHours(23, 59, 59, 999);

    await this.prisma.$transaction(async (tx) => {
      // Reutilizamos el motor central, pero con la fecha futura.
      // Esto generará el cargo y avanzará el puntero automáticamente.
      await this.ensureMonthlyCharges(tx, membership, fakeToday);
    });

    return { 
      message: 'Próxima cuota generada por adelantado exitosamente' 
    };
  }

  // Generar cargos iniciales para una nueva membresía recién creada
  async generateChargesForNewMembership(membershipId: string) {
    const membership = await this.prisma.playerMembership.findUnique({
      where: { id: membershipId },
      include: playerMembershipInclude,
    });

    if (!membership) {
      return;
    }

    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.ensureMembershipCharges(tx, membership, today);
      });
      this.logger.log(`Cargos generados/actualizados para nueva membresía ${membershipId}`);
    } catch (error) {
      this.logger.error(
        `Error generando cargos para nueva membresía ID ${membershipId}:`,
        error,
      );
    }
  }

  // Asegurar que los cargos de la membresía estén actualizados
  private async ensureMembershipCharges(
    tx: Prisma.TransactionClient,
    membership: PlayerMembershipWithRelations,
    today: Date,
  ) {
    // 1. Mantiene el cobro único de la matrícula de inscripción solo si no es migrado
    if (!membership.isMigrated) {
      await this.ensureRegistrationCharge(tx, membership);
    }

    // 2. Ejecuta el motor optimizado basado en eventos/punteros
    await this.ensureMonthlyCharges(tx, membership, today);
  }

  // Asegurar que el cargo de inscripción esté actualizado
  private async ensureRegistrationCharge(
    tx: Prisma.TransactionClient,
    membership: PlayerMembershipWithRelations,
  ) {
    // Verificar si ya existe un cargo de inscripción
    const exists = await tx.membershipCharge.findUnique({
      where: {
        playerMembershipId_type_billingMonth_billingYear: {
          playerMembershipId: membership.id,
          type: TypeMembershipCharge.REGISTRATION,
          billingYear: membership.startedAt.getUTCFullYear(),
          billingMonth: membership.startedAt.getUTCMonth() + 1,
        },
      },
    });

    // Si ya existe un cargo de inscripción, no hacer nada
    if (exists) return;

    // Calcular el monto del cargo de inscripción
    const { netAmount } = this.calculateRegistrationFee(membership);

    // Si el monto del cargo de inscripción es 0, no hacer nada
    if (netAmount <= 0) return;

    // Crear el cargo de inscripción
    await this.createCharge(
      tx,
      membership.id,
      {
        description: 'Inscripción',
        amount: netAmount,
        dueDate: membership.startedAt,
      },
      TypeMembershipCharge.REGISTRATION,
      membership.startedAt.getUTCFullYear(),
      membership.startedAt.getUTCMonth() + 1,
    );
  }

  // Asegurar que los cargos mensuales estén actualizados
  private async ensureMonthlyCharges(
    tx: Prisma.TransactionClient,
    membership: PlayerMembershipWithRelations,
    today: Date,
  ) {
    // 1. Obtener la fecha base e independizar el mes comercial para evitar ciclos infinitos
    let generationDate = membership.nextMonthlyChargeGenerationDate;
    // Variables para mantener el mes comercial
    let currentBillingYear: number;
    // Mes comercial (1-12)
    let currentBillingMonth: number;

    if (generationDate) {
      // Recuperar el mes comercial sumando los días de anticipación de forma segura
      const recoveredDueDate = new Date(generationDate);
      recoveredDueDate.setUTCDate(
        recoveredDueDate.getUTCDate() +
          membership.teamSeason.chargeGenerationDaysBefore,
      );
      currentBillingYear = recoveredDueDate.getUTCFullYear();
      currentBillingMonth = recoveredDueDate.getUTCMonth() + 1;
    } else {
      currentBillingYear = membership.startedAt.getUTCFullYear();
      currentBillingMonth = membership.startedAt.getUTCMonth() + 1;
      
      if (membership.isMigrated) {
        // Si es migrado, calculamos la próxima fecha a cobrar avanzando silenciosamente hasta que supere el 'today'
        let tempPointer = new Date(membership.startedAt);
        const billingDay = Number(membership.teamSeason.billingDay);
        const seasonEnd = new Date(membership.teamSeason.season.endDate);
        seasonEnd.setUTCHours(23, 59, 59, 999);

        while (tempPointer <= today) {
          let nextYear = currentBillingYear;
          let nextMonth = currentBillingMonth + 1;
          if (nextMonth > 12) {
            nextMonth = 1;
            nextYear += 1;
          }
          
          const maxDaysInNextMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
          const safeNextBillingDay = Math.min(billingDay, maxDaysInNextMonth);
          const nextDueDate = new Date(Date.UTC(nextYear, nextMonth - 1, safeNextBillingDay));
          
          const nextGenerationDate = new Date(nextDueDate);
          nextGenerationDate.setUTCDate(nextGenerationDate.getUTCDate() - membership.teamSeason.chargeGenerationDaysBefore);
          
          if (nextDueDate > seasonEnd) {
            tempPointer = new Date(0); // Para forzar escape si se pasa de temporada
            break;
          }
          
          tempPointer = nextGenerationDate;
          currentBillingYear = nextYear;
          currentBillingMonth = nextMonth;
        }

        // Si sobrepasamos la temporada, el puntero es null
        if (tempPointer.getTime() === 0) {
          generationDate = null;
          await tx.playerMembership.update({
            where: { id: membership.id },
            data: { nextMonthlyChargeGenerationDate: null },
          });
          return;
        }

        generationDate = tempPointer;
        // Se inicializa el puntero de BD en el futuro y salimos tempranamente del método para que el Cron se encargue a futuro
        await tx.playerMembership.update({
          where: { id: membership.id },
          data: { nextMonthlyChargeGenerationDate: generationDate },
        });
        return;

      } else {
        // Si recién se inscribe (y no es migrado) iniciamos con el mes/año de su fecha de arranque
        generationDate = new Date(membership.startedAt);
      }
    }

    // Esta variable se usa para actualizar la fecha de generación de cargos
    let nextPointer = membership.nextMonthlyChargeGenerationDate;

    // Obtener la fecha de fin de la temporada
    const seasonEnd = new Date(membership.teamSeason.season.endDate);
    // Establecer la fecha de fin de la temporada a las 23:59:59.999 para que se procesen todos los cargos del día
    seasonEnd.setUTCHours(23, 59, 59, 999);

    // Obtener el día de facturación establecido en la configuración de TeamSeason
    const billingDay = Number(membership.teamSeason.billingDay);

    // 2. El bucle "While" atrapa todos los meses que quedaron pendientes de pago en el pasado
    while (generationDate && generationDate <= today) {
      // 1. Determinar el mes/año comercial que se está cobrando
      // Se asigna seguro sin sufrir atrasos matemáticos originados por el offset de generationDate
      const billingYear = currentBillingYear;
      const billingMonth = currentBillingMonth;

      // 2. Definir la fecha de vencimiento real para ese mes
      // Obtenemos el último día del mes actual para evitar desbordamientos (ej: 31 de Febrero -> 3 de Marzo)
      const maxDaysInCurrentMonth = new Date(Date.UTC(billingYear, billingMonth, 0)).getUTCDate();
      const safeCurrentBillingDay = Math.min(billingDay, maxDaysInCurrentMonth);
      // billingMonth (1-12) es el que determina el período facturado. Osea si es 1 es Enero, 2 es Febrero, etc.
      const dueDate = new Date(Date.UTC(billingYear, billingMonth - 1, safeCurrentBillingDay));

      // Calcular próxima fecha de vencimiento tempranamente para uso en el prorrateo
      let nextYear = billingYear;
      let nextMonth = billingMonth + 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      const maxDaysInNextMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
      const safeNextBillingDay = Math.min(billingDay, maxDaysInNextMonth);
      const nextDueDate = new Date(Date.UTC(nextYear, nextMonth - 1, safeNextBillingDay));

      const isFirstMonth =
        billingYear === membership.startedAt.getUTCFullYear() &&
        billingMonth - 1 === membership.startedAt.getUTCMonth();

      // Formatear la descripción
      let description = this.buildMonthlyDescription(
        membership,
        billingYear,
        billingMonth,
      );

      // Si es el primer mes, indicamos de cuántos días consta el prorrateo
      if (isFirstMonth && nextDueDate) {
        const cycleDays = Math.round(
          (nextDueDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const activeDays = Math.max(
          0,
          Math.round(
            (nextDueDate.getTime() - membership.startedAt.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );

        // Solo lo agregamos si los días activos difieren del ciclo mensual estándar
        if (activeDays > 0 && activeDays !== cycleDays) {
          description += ` (Prorrateo por ${activeDays} días)`;
        }
      }

      // 3. Verificación de que no exista un cargo para el mes/año comercial
      const exists = await tx.membershipCharge.findUnique({
        where: {
          // Usamos el índice compuesto único para verificar si ya existe un cargo para el mes/año comercial
          playerMembershipId_type_billingMonth_billingYear: {
            playerMembershipId: membership.id,
            type: TypeMembershipCharge.MONTHLY_FEE,
            billingYear,
            billingMonth,
          },
        },
      });

      // Si no existe un cargo para el mes/año comercial, creamos el cargo
      if (!exists) {
        // Calcular el monto del cargo
        const { netAmount } = this.calculateMonthlyFeeForDate(
          membership,
          dueDate,
          isFirstMonth,
          nextDueDate,
        );

        // Si el monto del cargo es mayor a 0, creamos el cargo
        if (netAmount > 0) {
          // Crear el cargo
          await this.createCharge(
            tx,
            membership.id,
            // Datos del cargo
            { description, amount: netAmount, dueDate },
            // Tipo de cargo
            TypeMembershipCharge.MONTHLY_FEE,
            // Mes y año comercial
            billingYear,
            billingMonth,
          );
        }
      }

      // 4. Calcular el SIGUIENTE PUNTERO (usando la fecha de vencimiento del siguiente mes calculada arriba)
      // Obtenemos la fecha de generación del siguiente cargo
      const nextGenerationDate = new Date(nextDueDate);
      // Restamos los días de anticipación para la generación del siguiente cargo
      nextGenerationDate.setUTCDate(
        nextGenerationDate.getUTCDate() -
          membership.teamSeason.chargeGenerationDaysBefore,
      );

      // Si la fecha de vencimiento del siguiente mes es mayor a la fecha de fin de la temporada, salimos del bucle
      if (nextDueDate > seasonEnd) {
        nextPointer = null;
        break;
      }

      // Actualizamos el puntero
      nextPointer = nextGenerationDate;

      // Actualizamos la fecha de generación del siguiente cargo y avanzamos forzosamente los trackers
      generationDate = nextGenerationDate;
      currentBillingYear = nextYear;
      currentBillingMonth = nextMonth;
    }
    // 5. Actualizar Base de Datos y memoria local
    // Solo actualizamos la BD si el bucle avanzó el puntero
    if (
      membership.nextMonthlyChargeGenerationDate?.getTime() !==
      nextPointer?.getTime()
    ) {
      await tx.playerMembership.update({
        where: { id: membership.id },
        data: { nextMonthlyChargeGenerationDate: nextPointer },
      });
    }
  }

  private calculateRegistrationFee(
    membership: PlayerMembershipWithRelations,
  ): { baseAmount: number; discountPercent: number; discountAmount: number; netAmount: number } {
    const base = Number(membership.teamSeason.registrationFee);

    const discount = Math.min(
      100,
      // Descuento del plan de pago
      Number(membership.paymentPlan.registrationDiscountPercent) +
        // Descuentos de la membresía
        membership.membershipDiscounts
          .filter((d) => {
            const date = membership.startedAt;

            return d.startDate <= date && (!d.endDate || d.endDate >= date);
          })
          .reduce(
            (sum, discount) =>
              sum + Number(discount.registrationDiscountPercent),
            0,
          ),
    );

    let discountAmount = (base * discount) / 100;
    
    // Fix floating point errors
    discountAmount = Number(discountAmount.toFixed(2));
    let netAmount = Number(Math.max(0, base - discountAmount).toFixed(2));

    return {
      baseAmount: Number(base.toFixed(2)),
      discountPercent: Number(discount.toFixed(2)),
      discountAmount,
      netAmount,
    };
  }

  private calculateMonthlyFeeForDate(
    membership: PlayerMembershipWithRelations,
    dueDate: Date,
    isFirstMonth: boolean = false,
    nextDueDate?: Date,
  ): { baseAmount: number; discountPercent: number; discountAmount: number; netAmount: number } {
    // Obtener el monto base del cargo mensual
    let base = Number(membership.teamSeason.monthlyFee);

    // Prorratear base si es la primera mensualidad y si tenemos el nextDueDate
    if (isFirstMonth && nextDueDate) {
      // Calculamos los días exactos redondeados para evitar inexactitudes por cambios de horario de verano (DST)
      const cycleDays = Math.round(
        (nextDueDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const activeDays = Math.round(
        (nextDueDate.getTime() - membership.startedAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      // Factor proporcional. Ej: 15 / 30 = 0.5
      const factor = Math.max(0, cycleDays > 0 ? activeDays / cycleDays : 1);
      // Aplicamos el factor proporcional (ej: si son 15 días de 30, paga el 50%)
      base = base * factor;
    }

    // Calcular el descuento total
    const discount = Math.min(
      100,
      // Descuento fijo del plan de pago
      Number(membership.paymentPlan.monthlyDiscountPercent) +
        // Descuentos de la membresía que estén vigentes en la fecha de evaluación
        membership.membershipDiscounts
          .filter((d) => {
            // Si es la primera mensualidad y dueDate es anterior a la fecha real de inicio, evaluamos con la fecha de inicio
            const evalDate =
              dueDate < membership.startedAt ? membership.startedAt : dueDate;

            return (
              d.startDate <= evalDate && (!d.endDate || d.endDate >= evalDate)
            );
          })
          .reduce(
            (sum, discount) => sum + Number(discount.monthlyDiscountPercent),
            0,
          ),
    );

    let discountAmount = (base * discount) / 100;
    
    // Fix floating point errors
    discountAmount = Number(discountAmount.toFixed(2));
    let netAmount = Number(Math.max(0, base - discountAmount).toFixed(2));

    return {
      baseAmount: Number(base.toFixed(2)),
      discountPercent: Number(discount.toFixed(2)),
      discountAmount,
      netAmount,
    };
  }

  private buildMonthlyDescription(
    membership: PlayerMembershipWithRelations,
    billingYear: number,
    billingMonth: number,
  ): string {
    // Verificar si el mes de facturación es el mismo que el mes de inicio de la membresía
    const isEnrollmentMonth =
      billingYear === membership.startedAt.getUTCFullYear() &&
      billingMonth - 1 === membership.startedAt.getUTCMonth();

    // Si es el mes de inscripción, retornar "Primera Mensualidad"
    if (isEnrollmentMonth) {
      return 'Primera Mensualidad';
    }

    // Obtener el nombre del mes
    const capitalizedMonthName = this.MONTH_NAMES[billingMonth - 1];
    // Retornar la descripción del cargo
    return `Mensualidad - ${capitalizedMonthName} ${billingYear}`;
  }

  private async createCharge(
    tx: Prisma.TransactionClient,
    membershipId: string,
    charge: {
      description: string;
      amount: number;
      dueDate: Date;
    },
    type: TypeMembershipCharge,
    billingYear: number,
    billingMonth: number,
  ) {
    await tx.charge.create({
      data: {
        description: charge.description,
        amount: charge.amount,
        pendingAmount: charge.amount,
        dueDate: charge.dueDate,
        status: StatusCharge.PENDING,
        membershipCharges: {
          create: {
            playerMembershipId: membershipId,
            type,
            billingYear,
            billingMonth,
          },
        },
      },
    });
  }
}
