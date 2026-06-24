import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreatePaymentPlanDto } from './dto/create-payment-plan.dto';
import { UpdatePaymentPlanDto } from './dto/update-payment-plan.dto';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { PaymentPlansPaginationDto } from './dto/pagination.dto';

export const paymentPlanSelect: Prisma.PaymentPlanSelect = {
  id: true,
  teamSeasonId: true,
  name: true,
  registrationDiscountPercent: true,
  monthlyDiscountPercent: true,

  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class PaymentPlansService {
  private readonly logger = new Logger('PaymentPlansService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createPaymentPlanDto: CreatePaymentPlanDto) {
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
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.PaymentPlanWhereInput = {
      name: search ? { contains: search, mode: 'insensitive' } : undefined,
    };

    where.teamSeasonId = teamSeasonId;

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
      select: paymentPlanSelect,
    });
    if (!paymentPlan) {
      throw new NotFoundException('El plan de pago no fue encontrado');
    }
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
