import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreatePaymentPlanDto } from './dto/create-payment-plan.dto';
import { UpdatePaymentPlanDto } from './dto/update-payment-plan.dto';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { PaymentPlansPaginationDto } from './dto/pagination.dto';

export const paymentPlanSelect: Prisma.PaymentPlanSelect = {
  id: true,
  teamSeasonId: true,
  courseSeasonId: true,
  name: true,
  registrationDiscountPercent: true,
  recurringDiscountPercent: true,
  seasonFeeDiscountPercent: true,
  advanceCycles: true,
  advanceCyclesDiscountPercent: true,
  isSinglePayment: true,
  isDefault: true,

  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class PaymentPlansService {
  private readonly logger = new Logger('PaymentPlansService');

  constructor(private readonly prisma: PrismaService) {}

  private async validateAndSanitizeDiscounts(
    data: CreatePaymentPlanDto | UpdatePaymentPlanDto,
    existingPlan?: { teamSeasonId?: string | null; courseSeasonId?: string | null }
  ) {
    const teamSeasonId = data.teamSeasonId !== undefined ? data.teamSeasonId : existingPlan?.teamSeasonId;
    const courseSeasonId = data.courseSeasonId !== undefined ? data.courseSeasonId : existingPlan?.courseSeasonId;

    if (!teamSeasonId && !courseSeasonId) {
      return;
    }

    let billingType = 'MONTHLY_ONLY'; // default safe fallback
    let billingFrequency = 'MONTHLY';
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (teamSeasonId) {
      const ts = await this.prisma.teamSeason.findUnique({ where: { id: teamSeasonId }, include: { season: true } });
      if (!ts) throw new NotFoundException('TeamSeason no encontrado');
      billingType = ts.billingType;
      billingFrequency = ts.billingFrequency;
      if (ts.season) { startDate = ts.season.startDate; endDate = ts.season.endDate; }
    } else if (courseSeasonId) {
      const cs = await this.prisma.courseSeason.findUnique({ where: { id: courseSeasonId }, include: { season: true } });
      if (!cs) throw new NotFoundException('CourseSeason no encontrado');
      billingType = cs.billingType;
      billingFrequency = cs.billingFrequency;
      if (cs.season) { startDate = cs.season.startDate; endDate = cs.season.endDate; }
    }

    let maxCycles = 120; // fallback para evitar bloqueos si faltan fechas
    if (startDate && endDate) {
       const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
       if (billingFrequency === 'MONTHLY') {
          maxCycles = Math.ceil(days / 30) + 1;
       } else if (billingFrequency === 'BIWEEKLY') {
          maxCycles = Math.ceil(days / 14) + 1;
       } else if (billingFrequency === 'WEEKLY') {
          maxCycles = Math.ceil(days / 7) + 1;
       } else if (billingFrequency === 'SINGLE') {
          maxCycles = 1;
       }
    }
    
    const advance = (data as any).advanceCycles || 1;
    
    if (advance > maxCycles) {
       throw new BadRequestException(`El número de cuotas adelantadas (${advance}) no puede superar la duración máxima de la temporada (${maxCycles} ciclos).`);
    }

    if (billingType === 'SINGLE_ONLY') {
      if (advance > 1) {
          throw new BadRequestException(`No se pueden configurar ciclos por adelantado en temporadas de pago único.`);
      }
      data.recurringDiscountPercent = '0.00';
      data.registrationDiscountPercent = '0.00';
      data.isSinglePayment = true;
    } else if (billingType === 'MONTHLY_ONLY') {
      data.seasonFeeDiscountPercent = '0.00';
    }
  }

  async create(createPaymentPlanDto: CreatePaymentPlanDto) {
    await this.validateAndSanitizeDiscounts(createPaymentPlanDto);
    const newPaymentPlan = await this.prisma.paymentPlan.create({
      data: {
        ...createPaymentPlanDto,
      },
      select: paymentPlanSelect,
    });

    return {
      message: 'Plan de pago agregado exitosamente',
      data: newPaymentPlan,
    };
  }

  async findAll(paginationDto: PaymentPlansPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      teamSeasonId,
      courseSeasonId,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.PaymentPlanWhereInput = {
      name: search ? { contains: search, mode: 'insensitive' } : undefined,
    };

    if (teamSeasonId) {
      where.teamSeasonId = teamSeasonId;
    }
    if (courseSeasonId) {
      where.courseSeasonId = courseSeasonId;
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [paymentPlans, totalItems] = await Promise.all([
      this.prisma.paymentPlan.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: paymentPlanSelect,
      }),
      this.prisma.paymentPlan.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      message: 'Planes de pago obtenidos exitosamente',
      data: paymentPlans, // Será [] si la página no existe o no hay registros
      meta: {
        totalItems, // Ej: 25
        itemsPerPage: per_page, // Ej: 10
        totalPages, // Ej: 3
        currentPage, // Ej: 10 (si el usuario pidió el page 90)
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  }

  async findOne(id: string) {
    const paymentPlan = await this.prisma.paymentPlan.findUnique({
      where: { id },
      select: paymentPlanSelect,
    });
    if (!paymentPlan) {
      throw new NotFoundException('El plan de pago no fue encontrado');
    }
    return {
      data: paymentPlan,
      message: 'Plan de pago obtenido exitosamente',
    };
  }

  async update(id: string, updatePaymentPlanDto: UpdatePaymentPlanDto) {
    const paymentPlan = await this.prisma.paymentPlan.findUnique({
      where: { id },
      select: { ...paymentPlanSelect, teamSeasonId: true, courseSeasonId: true },
    });
    if (!paymentPlan) {
      throw new NotFoundException('El plan de pago no fue encontrado');
    }
    await this.validateAndSanitizeDiscounts(updatePaymentPlanDto, paymentPlan);

    const updatedPaymentPlan = await this.prisma.paymentPlan.update({
      where: { id },
      data: updatePaymentPlanDto,
      select: paymentPlanSelect,
    });
    return {
      message: 'Plan de pago actualizado exitosamente',
      data: updatedPaymentPlan,
    };
  }

  async remove(id: string) {
    const paymentPlan = await this.prisma.paymentPlan.findUnique({
      where: { id },
      select: paymentPlanSelect,
    });
    if (!paymentPlan) {
      throw new NotFoundException('El plan de pago no fue encontrado');
    }
    const deletedPaymentPlan = await this.prisma.paymentPlan.delete({
      where: { id },
      select: paymentPlanSelect,
    });
    return {
      message: 'Plan de pago eliminado exitosamente',
      data: deletedPaymentPlan,
    };
  }
}
