import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateMembershipChargeDto } from './dto/create-membership-charge.dto';
import { UpdateMembershipChargeDto } from './dto/update-membership-charge.dto';
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

  // Aplicar cargos mensuales
  async applyDailyMembershipCharges() {
    this.logger.log('Iniciando proceso diario de cálculo de cargos...');

    // Obtener la fecha actual con la hora establecida a las 23:59:59.999 para que se procesen todos los cargos del día
    const today = new Date();
    today.setHours(23, 59, 59, 999);
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

  // Asegurar que los cargos de la membresía estén actualizados
  private async ensureMembershipCharges(
    tx: Prisma.TransactionClient,
    membership: PlayerMembershipWithRelations,
    today: Date,
  ) {
    // 1. Mantiene el cobro único de la matrícula de inscripción
    await this.ensureRegistrationCharge(tx, membership);

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
          billingYear: membership.startedAt.getFullYear(),
          billingMonth: membership.startedAt.getMonth() + 1,
        },
      },
    });

    // Si ya existe un cargo de inscripción, no hacer nada
    if (exists) return;

    // Calcular el monto del cargo de inscripción
    const amount = this.calculateRegistrationFee(membership);

    // Si el monto del cargo de inscripción es 0, no hacer nada
    if (amount <= 0) return;

    // Crear el cargo de inscripción
    await this.createCharge(
      tx,
      membership.id,
      {
        description: 'Inscripción',
        amount,
        dueDate: membership.startedAt,
      },
      TypeMembershipCharge.REGISTRATION,
      membership.startedAt.getFullYear(),
      membership.startedAt.getMonth() + 1,
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
      recoveredDueDate.setDate(
        recoveredDueDate.getDate() +
          membership.teamSeason.chargeGenerationDaysBefore,
      );
      currentBillingYear = recoveredDueDate.getFullYear();
      currentBillingMonth = recoveredDueDate.getMonth() + 1;
    } else {
      // Si recién se inscribe iniciamos con el mes/año de su fecha de arranque
      generationDate = new Date(membership.startedAt);
      currentBillingYear = membership.startedAt.getFullYear();
      currentBillingMonth = membership.startedAt.getMonth() + 1;
    }

    // Esta variable se usa para actualizar la fecha de generación de cargos
    let nextPointer = membership.nextMonthlyChargeGenerationDate;

    // Obtener la fecha de fin de la temporada
    const seasonEnd = new Date(membership.teamSeason.season.endDate);
    // Establecer la fecha de fin de la temporada a las 23:59:59.999 para que se procesen todos los cargos del día
    seasonEnd.setHours(23, 59, 59, 999);

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
      const maxDaysInCurrentMonth = new Date(
        billingYear,
        billingMonth,
        0,
      ).getDate();
      const safeCurrentBillingDay = Math.min(billingDay, maxDaysInCurrentMonth);
      // billingMonth (1-12) es el que determina el período facturado. Osea si es 1 es Enero, 2 es Febrero, etc.
      const dueDate = new Date(
        billingYear,
        billingMonth - 1,
        safeCurrentBillingDay,
      );

      // Calcular próxima fecha de vencimiento tempranamente para uso en el prorrateo
      let nextYear = billingYear;
      let nextMonth = billingMonth + 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      const maxDaysInNextMonth = new Date(nextYear, nextMonth, 0).getDate();
      const safeNextBillingDay = Math.min(billingDay, maxDaysInNextMonth);
      const nextDueDate = new Date(nextYear, nextMonth - 1, safeNextBillingDay);

      const isFirstMonth =
        billingYear === membership.startedAt.getFullYear() &&
        billingMonth - 1 === membership.startedAt.getMonth();

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
        const amount = this.calculateMonthlyFeeForDate(
          membership,
          dueDate,
          isFirstMonth,
          nextDueDate,
        );

        // Si el monto del cargo es mayor a 0, creamos el cargo
        if (amount > 0) {
          // Crear el cargo
          await this.createCharge(
            tx,
            membership.id,
            // Datos del cargo
            { description, amount, dueDate },
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
      nextGenerationDate.setDate(
        nextGenerationDate.getDate() -
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
  ): number {
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

    return Math.max(0, base - (base * discount) / 100);
  }

  private calculateMonthlyFeeForDate(
    membership: PlayerMembershipWithRelations,
    dueDate: Date,
    isFirstMonth: boolean = false,
    nextDueDate?: Date,
  ): number {
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

    return Math.max(0, base - (base * discount) / 100);
  }

  private buildMonthlyDescription(
    membership: PlayerMembershipWithRelations,
    billingYear: number,
    billingMonth: number,
  ): string {
    // Verificar si el mes de facturación es el mismo que el mes de inicio de la membresía
    const isEnrollmentMonth =
      billingYear === membership.startedAt.getFullYear() &&
      billingMonth - 1 === membership.startedAt.getMonth();

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
