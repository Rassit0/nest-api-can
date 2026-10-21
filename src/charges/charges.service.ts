import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateChargeDto } from './dto/create-charge.dto';
import { UpdateChargeDto } from './dto/update-charge.dto';
import { UpdateDueDateDto } from './dto/update-due-date.dto';
import { AddAdjustmentDto } from './dto/add-adjustment.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma, StatusCharge } from 'src/generated/prisma/client';
import { ChargesPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';
import { syncCycleEnrollmentStatus } from 'src/common/helpers/sync-cycle-enrollment.helper';
import { isCycleEnrollmentExpired } from 'src/common/helpers/cycle-enrollment.helper';
import { lockChargeForUpdate } from 'src/common/utils/charge-lock.util';

export const chargeSelect: Prisma.ChargeSelect = {
  id: true,
  description: true,
  amount: true,
  pendingAmount: true,
  adjustmentAmount: true,
  adjustmentReason: true,
  dueDate: true,
  status: true,
  parentChargeId: true,
  createdAt: true,
  updatedAt: true,
  parentCharge: {
    select: {
      id: true,
      description: true,
      amount: true,
    },
  },
  childCharges: {
    select: {
      id: true,
      description: true,
      amount: true,
      pendingAmount: true,
      status: true,
    },
  },
  accountCharge: {
    select: {
      id: true,
    },
  },
  membershipCharges: {
    select: {
      id: true,
      type: true,
      playerMembership: {
        select: {
          id: true,
          player: {
            select: {
              id: true,
              person: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  secondLastName: true,
                  email: true,
                  documentNumber: true,
                  gender: true,
                  birthDate: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      },
    },
  },
  studentCharges: {
    select: {
      id: true,
      type: true,
      studentMembership: {
        select: {
          id: true,
          student: {
            select: {
              id: true,
              person: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  secondLastName: true,
                  email: true,
                  documentNumber: true,
                  gender: true,
                  birthDate: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      },
    },
  },
  cycleEnrollment: {
    select: {
      id: true,
      status: true,
      cycleStartDate: true,
      cycleEndDate: true,
      attempt: true,
      cancellationReason: true,
      cancelledAt: true,
      courseSeason: {
        select: {
          id: true,
          course: {
            select: {
              name: true,
            },
          },
        },
      },
      courseSeasonShift: {
        select: {
          id: true,
          shift: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  },
  payments: {
    select: {
      amount: true,
      status: true,
    },
  },
};

function mapChargeForFrontend(charge: any) {
  const amount = Number(charge.amount);
  const adjustmentAmount = Number(charge.adjustmentAmount || 0);

  const paidAmount = charge.payments
    ? charge.payments
        .filter((p: any) => p.status === 'COMPLETED')
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0)
    : 0;

  const expectedTotal = amount + adjustmentAmount;
  const isFullyPaidWithMoney = paidAmount > 0 && paidAmount >= expectedTotal;
  const hasAdjustment = adjustmentAmount !== 0;

  const canEditAdjustment = charge.status !== 'CANCELLED' && !isFullyPaidWithMoney;
  const canRemoveAdjustment = hasAdjustment && charge.status !== 'CANCELLED' && !isFullyPaidWithMoney;

  const { payments, ...chargeWithoutPayments } = charge;

  return {
    ...chargeWithoutPayments,
    canEditAdjustment,
    canRemoveAdjustment,
  };
}

@Injectable()
export class ChargesService {
  private readonly logger = new Logger('ChargesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createChargeDto: CreateChargeDto, tx?: Prisma.TransactionClient) {
    const { amount, pendingAmount } = createChargeDto;

    // Si pendingAmount no es proveído, por defecto es igual a amount
    const chargeData = {
      ...createChargeDto,
      pendingAmount:
        pendingAmount !== undefined && pendingAmount !== null
          ? pendingAmount
          : amount,
    };

    const prismaClient = tx || this.prisma;
    const newCharge = await prismaClient.charge.create({
      data: chargeData,
      select: chargeSelect,
    });

    return {
      message: 'Cargo facturado creado exitosamente',
      data: mapChargeForFrontend(newCharge),
    };
  }

  async findAll(paginationDto: ChargesPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      playerMembershipId,
      studentMembershipId,
      teamSeasonId,
      courseSeasonId,
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.ChargeWhereInput = {};

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        {
          membershipCharges: {
            some: {
              playerMembership: {
                player: {
                  person: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          },
        },
        {
          studentCharges: {
            some: {
              studentMembership: {
                student: {
                  person: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          },
        },
      ];
    }

    if (playerMembershipId) {
      where.membershipCharges = {
        some: {
          playerMembership: {
            id: playerMembershipId,
          },
        },
      };
    }

    if (studentMembershipId) {
      where.studentCharges = {
        some: {
          studentMembership: {
            id: studentMembershipId,
          },
        },
      };
    }

    if (teamSeasonId) {
      where.membershipCharges = {
        some: {
          playerMembership: {
            teamSeasonId,
          },
        },
      };
    }

    if (courseSeasonId) {
      where.studentCharges = {
        some: {
          studentMembership: {
            courseSeasonId,
          },
        },
      };
    }

    const [charges, totalItems] = await Promise.all([
      this.prisma.charge.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: chargeSelect,
      }),
      this.prisma.charge.count({ where }),
    ]);

    const mappedCharges = charges.map(mapChargeForFrontend);

    return createPaginationResult(
      mappedCharges,
      totalItems,
      page,
      per_page,
      'Cargos obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
      select: chargeSelect,
    });
    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }
    return {
      message: 'Cargo obtenido exitosamente',
      data: mapChargeForFrontend(charge),
    };
  }

  async updateDueDate(id: string, updateDueDateDto: UpdateDueDateDto) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
    });
    
    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }

    if (charge.status === StatusCharge.CANCELLED) {
      throw new BadRequestException('No se puede modificar un cargo anulado.');
    }

    const updated = await this.prisma.charge.update({
      where: { id },
      data: {
        dueDate: new Date(updateDueDateDto.dueDate),
      },
      select: chargeSelect,
    });

    return {
      message: 'Fecha de vencimiento actualizada exitosamente',
      data: mapChargeForFrontend(updated),
    };
  }

  async update(id: string, updateChargeDto: UpdateChargeDto) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
      include: {
        membershipCharges: true,
        studentCharges: true,
        payments: true,
      },
    });
    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }

    const isManual =
      charge.membershipCharges.some((mc) => mc.type === 'MANUAL') ||
      charge.studentCharges.some((sc) => sc.type === 'MANUAL');

    if (!isManual) {
      throw new BadRequestException(
        'Solo se pueden editar cargos creados de forma manual.',
      );
    }

    if (charge.payments && charge.payments.length > 0) {
      throw new BadRequestException(
        'No se puede editar un cargo que ya tiene transacciones (pagos) registradas.',
      );
    }

    const { parentChargeId, ...rest } = updateChargeDto;
    const data: Prisma.ChargeUpdateInput = { ...rest };

    if (rest.amount !== undefined) {
      const newAmount = Number(rest.amount);
      const adjustment = Number(charge.adjustmentAmount || 0);
      const newExpectedTotal = newAmount + adjustment;

      if (newExpectedTotal < 0) {
        throw new BadRequestException(
          'El nuevo monto base sumado al ajuste no puede ser negativo.',
        );
      }

      const oldExpectedTotal = Number(charge.amount) + Number(charge.adjustmentAmount || 0);
      const paidAmount = oldExpectedTotal - Number(charge.pendingAmount);

      let newPending = newExpectedTotal - paidAmount;
      if (newPending < 0) newPending = 0;

      data.pendingAmount = newPending;
      if (newPending === 0) data.status = StatusCharge.PAID;
      else if (paidAmount > 0) data.status = StatusCharge.PARTIAL;
      else data.status = StatusCharge.PENDING;
    }

    if (parentChargeId !== undefined) {
      if (parentChargeId === null) {
        data.parentCharge = { disconnect: true };
      } else {
        data.parentCharge = { connect: { id: parentChargeId } };
      }
    }

    const updatedCharge = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.charge.update({
        where: { id },
        data,
        select: chargeSelect,
      });

      if (data.status) {
        await syncCycleEnrollmentStatus(tx, id, data.status as StatusCharge);
      }

      return updated;
    });

    return {
      message: 'Cargo actualizado exitosamente',
      data: mapChargeForFrontend(updatedCharge),
    };
  }

  async remove(id: string) {
    const deletedCharge = await this.prisma.$transaction(async (tx) => {
      // 1. Bloquear el cargo para evitar modificaciones concurrentes (ej: creación de pagos simultánea)
      await lockChargeForUpdate(tx, id);

      // 2. Leer las dependencias con estado íntegro
      const charge = await tx.charge.findUnique({
        where: { id },
        include: {
          membershipCharges: true,
          studentCharges: true,
          payments: true,
          accountCharge: true,
        },
      });

      if (!charge) {
        throw new NotFoundException('El cargo solicitado no fue encontrado');
      }

      const isManual =
        charge.membershipCharges.some((mc) => mc.type === 'MANUAL') ||
        charge.studentCharges.some((sc) => sc.type === 'MANUAL') ||
        charge.accountCharge !== null;

      if (!isManual) {
        throw new BadRequestException(
          'Solo se pueden eliminar cargos creados de forma manual.',
        );
      }

      const hasCompletedPayments = charge.payments.some(
        (p) => p.status === 'COMPLETED',
      );
      if (hasCompletedPayments) {
        throw new BadRequestException(
          'No se puede eliminar el cargo porque tiene transacciones (pagos) completadas asociadas.',
        );
      }

      const hasHistoricalPayments = charge.payments.length > 0;

      if (hasHistoricalPayments) {
        // Soft delete para conservar historial y referencias
        return tx.charge.update({
          where: { id },
          data: { status: StatusCharge.CANCELLED },
          select: chargeSelect,
        });
      } else {
        // Hard delete
        if (charge.membershipCharges.length > 0) {
          await tx.membershipCharge.deleteMany({
            where: { chargeId: id },
          });
        }

        if (charge.studentCharges.length > 0) {
          await tx.studentCharge.deleteMany({
            where: { chargeId: id },
          });
        }

        return tx.charge.delete({
          where: { id },
          select: chargeSelect,
        });
      }
    });

    return {
      message: 'Cargo eliminado exitosamente',
      data: mapChargeForFrontend(deletedCharge),
    };
  }

  async addAdjustment(id: string, addAdjustmentDto: AddAdjustmentDto) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
      include: {
        payments: true,
        cycleEnrollment: {
          include: {
            studentMembership: true,
          },
        },
      },
    });
    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }

    if (charge.status === 'CANCELLED') {
      throw new BadRequestException('No se puede modificar un cargo cancelado.');
    }

    const amount = Number(charge.amount);
    const newAdjustment = Number(addAdjustmentDto.adjustmentAmount);
    
    const newExpectedTotal = amount + newAdjustment;

    if (newExpectedTotal < 0) {
      throw new BadRequestException(
        'El total esperado (monto + ajuste) no puede ser negativo',
      );
    }

    const oldAdjustment = Number(charge.adjustmentAmount || 0);

    const hasProcessingPayments = charge.payments?.some(
      (p) => (p.status === 'PROCESSING' || p.status === 'PENDING') && Number(p.amount) > 0,
    );
    if (hasProcessingPayments) {
      throw new BadRequestException(
        'No se puede aplicar un ajuste a un cargo que tiene pagos en procesamiento o pendientes de confirmación.',
      );
    }

    const paidAmount = charge.payments
      ? charge.payments
          .filter((p) => p.status === 'COMPLETED')
          .reduce((sum, p) => sum + Number(p.amount), 0)
      : 0;

    const oldExpectedTotal = amount + oldAdjustment;
    const isFullyPaidWithMoney = paidAmount > 0 && paidAmount >= oldExpectedTotal;

    if (isFullyPaidWithMoney) {
      throw new BadRequestException(
        'No se puede modificar el ajuste de un cargo que ya fue pagado completamente con dinero real.',
      );
    }

    let newPending = newExpectedTotal - paidAmount;
    if (newPending < 0) {
      newPending = 0;
    }

    // Reglas de negocio para cargos asociados a CycleEnrollment
    const isCycleCharge = !!charge.cycleEnrollment;
    const cycleStatus = charge.cycleEnrollment?.status;

    if (isCycleCharge && cycleStatus === 'CANCELLED') {
      throw new BadRequestException(
        'No se puede aplicar un ajuste a un cargo cuyo ciclo ya fue cancelado. Debe generar una reinscripción.',
      );
    }

    let finalAdjustmentReason = addAdjustmentDto.adjustmentReason;

    if (isCycleCharge && cycleStatus === 'PENDING' && newPending <= 0) {
      if (!addAdjustmentDto.isScholarship) {
        throw new BadRequestException(
          'Para anular una inscripción de ciclo por error o desistimiento, utilice la opción "Cancelar cargo e inscripción". Si se trata de un descuento total autorizado o beca que confirma la participación del estudiante, seleccione expresamente la opción "Mantener inscripción — Descuento total autorizado".',
        );
      }

      if (paidAmount > 0) {
        throw new BadRequestException(
          'No se puede aplicar un descuento total o beca a un ciclo que ya cuenta con pagos registrados.',
        );
      }

      if (!addAdjustmentDto.adjustmentReason || !addAdjustmentDto.adjustmentReason.trim()) {
        throw new BadRequestException(
          'El motivo o justificación de la autorización es obligatorio al aplicar un descuento total.',
        );
      }

      const reasonText = addAdjustmentDto.adjustmentReason.trim();
      if (
        reasonText.includes('[DESCUENTO TOTAL AUTORIZADO]') ||
        reasonText.includes('[BECA 100%]')
      ) {
        finalAdjustmentReason = reasonText;
      } else if (/beca/i.test(reasonText)) {
        finalAdjustmentReason = `[BECA 100%] ${reasonText}`;
      } else {
        finalAdjustmentReason = `[DESCUENTO TOTAL AUTORIZADO] ${reasonText}`;
      }
    }

    let newStatus: StatusCharge;
    if (newPending <= 0) {
      newStatus = StatusCharge.PAID;
    } else if (paidAmount > 0) {
      newStatus = StatusCharge.PARTIAL;
    } else {
      newStatus = StatusCharge.PENDING;
    }

    const updatedCharge = await this.prisma.$transaction(async (tx) => {
      await lockChargeForUpdate(tx, id);

      const updated = await tx.charge.update({
        where: { id },
        data: {
          adjustmentAmount: newAdjustment,
          adjustmentReason: finalAdjustmentReason,
          pendingAmount: newPending,
          status: newStatus,
        },
        select: chargeSelect,
      });

      await syncCycleEnrollmentStatus(tx, id, newStatus);
      return updated;
    });

    return {
      message: 'Ajuste agregado exitosamente',
      data: mapChargeForFrontend(updatedCharge),
    };
  }

  async removeAdjustment(id: string) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
      include: {
        payments: true,
        cycleEnrollment: {
          include: {
            studentMembership: true,
          },
        },
      },
    });
    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }

    if (charge.status === 'CANCELLED') {
      throw new BadRequestException('No se puede modificar un cargo cancelado.');
    }

    const oldAdjustment = Number(charge.adjustmentAmount || 0);
    if (oldAdjustment === 0) {
      throw new BadRequestException('El cargo no tiene un ajuste aplicado');
    }

    const hasProcessingPayments = charge.payments?.some(
      (p) => (p.status === 'PROCESSING' || p.status === 'PENDING') && Number(p.amount) > 0,
    );
    if (hasProcessingPayments) {
      throw new BadRequestException(
        'No se puede remover el ajuste de un cargo que tiene pagos en procesamiento o pendientes de confirmación.',
      );
    }

    const amount = Number(charge.amount);
    const paidAmount = charge.payments
      ? charge.payments
          .filter((p) => p.status === 'COMPLETED')
          .reduce((sum, p) => sum + Number(p.amount), 0)
      : 0;

    const oldExpectedTotal = amount + oldAdjustment;
    const isFullyPaidWithMoney = paidAmount > 0 && paidAmount >= oldExpectedTotal;

    if (isFullyPaidWithMoney) {
      throw new BadRequestException(
        'No se puede remover el ajuste de un cargo que ya fue pagado completamente con dinero real.',
      );
    }

    // Reglas de seguridad para remover ajustes en cargos asociados a CycleEnrollment
    if (charge.cycleEnrollment) {
      const cycle = charge.cycleEnrollment;
      if (cycle.status === 'CANCELLED') {
        throw new BadRequestException(
          'No se puede modificar un cargo de un ciclo cancelado.',
        );
      }

      if (cycle.status === 'CONFIRMED') {
        // Verificar si tiene asistencias registradas
        const attendedBookings = await this.prisma.sessionBooking.count({
          where: {
            studentId: cycle.studentMembership.studentId,
            attended: true,
            session: {
              event: {
                startDate: {
                  gte: cycle.cycleStartDate,
                  lte: cycle.cycleEndDate,
                },
              },
            },
          },
        });

        if (attendedBookings > 0) {
          throw new BadRequestException(
            'No se puede remover el ajuste de un ciclo confirmado que ya cuenta con asistencias registradas. Requiere regularización administrativa.',
          );
        }

        // Verificar si el período ya inició o finalizó
        const now = new Date();
        if (cycle.cycleStartDate < now) {
          throw new BadRequestException(
            'No se puede remover el ajuste de un ciclo cuyo período ya inició o ha finalizado. Requiere regularización administrativa.',
          );
        }

        // Verificar si el plazo original de reserva (72h) ya expiró
        if (isCycleEnrollmentExpired(cycle.createdAt)) {
          throw new BadRequestException(
            'No se puede remover el ajuste porque el plazo original de reserva (72h) del ciclo ya ha expirado. Revertir el ciclo a pendiente provocaría su cancelación inmediata por cron. Requiere regularización administrativa.',
          );
        }
      }
    }

    const newExpectedTotal = amount; // Sin ajuste

    let newPending = newExpectedTotal - paidAmount;
    if (newPending < 0) {
      newPending = 0;
    }

    let newStatus: StatusCharge;
    if (newPending <= 0) {
      newStatus = StatusCharge.PAID;
    } else if (paidAmount > 0) {
      newStatus = StatusCharge.PARTIAL;
    } else {
      newStatus = StatusCharge.PENDING;
    }

    const updatedCharge = await this.prisma.$transaction(async (tx) => {
      await lockChargeForUpdate(tx, id);

      const updated = await tx.charge.update({
        where: { id },
        data: {
          adjustmentAmount: 0,
          adjustmentReason: null,
          pendingAmount: newPending,
          status: newStatus,
        },
        select: chargeSelect,
      });
      await syncCycleEnrollmentStatus(tx, id, newStatus);
      return updated;
    });

    return {
      message: 'Ajuste eliminado exitosamente',
      data: mapChargeForFrontend(updatedCharge),
    };
  }

}
