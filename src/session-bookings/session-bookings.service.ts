import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateSessionBookingDto } from './dto/create-session-booking.dto';
import { UpdateSessionBookingDto } from './dto/update-session-booking.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { SessionBookingsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const sessionBookingSelect: Prisma.SessionBookingSelect = {
  id: true,
  isExternal: true,
  attended: true,
  chargeId: true,
  createdAt: true,
  updatedAt: true,
  session: {
    select: {
      id: true,
      title: true,
      dateTime: true,
      durationMin: true,
    },
  },
  player: {
    select: {
      id: true,
      isActive: true,
      person: {
        select: {
          id: true,
          name: true,
          lastName: true,
          secondLastName: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  charge: {
    select: {
      id: true,
      amount: true,
      pendingAmount: true,
      status: true,
    },
  },
};

@Injectable()
export class SessionBookingsService {
  private readonly logger = new Logger('SessionBookingsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createSessionBookingDto: CreateSessionBookingDto) {
    const newBooking = await this.prisma.sessionBooking.create({
      data: createSessionBookingDto,
      select: sessionBookingSelect,
    });

    return {
      message: 'Inscripción/Reserva de entrenamiento creada exitosamente',
      data: newBooking,
    };
  }

  async findAll(paginationDto: SessionBookingsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.SessionBookingWhereInput = {};

    if (search) {
      where.OR = [
        {
          player: {
            person: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          session: {
            title: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [bookings, totalItems] = await Promise.all([
      this.prisma.sessionBooking.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: sessionBookingSelect,
      }),
      this.prisma.sessionBooking.count({ where }),
    ]);

    return createPaginationResult(
      bookings,
      totalItems,
      page,
      per_page,
      'Reservas de entrenamiento obtenidas exitosamente',
    );
  }

  async findOne(id: string) {
    const booking = await this.prisma.sessionBooking.findUnique({
      where: { id },
      select: sessionBookingSelect,
    });
    if (!booking) {
      throw new NotFoundException(
        'La reserva de entrenamiento solicitada no fue encontrada',
      );
    }
    return {
      message: 'Reserva de entrenamiento obtenida exitosamente',
      data: booking,
    };
  }

  async update(id: string, updateSessionBookingDto: UpdateSessionBookingDto) {
    const booking = await this.prisma.sessionBooking.findUnique({
      where: { id },
    });
    if (!booking) {
      throw new NotFoundException(
        'La reserva de entrenamiento solicitada no fue encontrada',
      );
    }

    const updatedBooking = await this.prisma.sessionBooking.update({
      where: { id },
      data: updateSessionBookingDto,
      select: sessionBookingSelect,
    });

    return {
      message: 'Reserva de entrenamiento actualizada exitosamente',
      data: updatedBooking,
    };
  }

  async remove(id: string) {
    const booking = await this.prisma.sessionBooking.findUnique({
      where: { id },
    });
    if (!booking) {
      throw new NotFoundException(
        'La reserva de entrenamiento solicitada no fue encontrada',
      );
    }

    const deletedBooking = await this.prisma.sessionBooking.delete({
      where: { id },
      select: sessionBookingSelect,
    });

    return {
      message: 'Reserva de entrenamiento eliminada exitosamente',
      data: deletedBooking,
    };
  }
}
