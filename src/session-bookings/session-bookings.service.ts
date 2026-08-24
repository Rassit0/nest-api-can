import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
      event: {
        select: {
          title: true,
          startDate: true,
        },
      },
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
  studentId: true,
  student: {
    select: {
      id: true,
      person: {
        select: {
          id: true,
          name: true,
          lastName: true,
          secondLastName: true,
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
    const { sessionId, playerId, studentId } = createSessionBookingDto;

    if (!playerId && !studentId) {
      throw new BadRequestException('Se debe proveer playerId o studentId');
    }
    if (playerId && studentId) {
      throw new BadRequestException('Solo se debe proveer playerId o studentId, no ambos');
    }

    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        event: true,
        sessionCourses: {
          include: { courseSeasonShift: true },
        },
      },
    });

    // Validar autorización si es un CourseSeason y enviaron studentId
    if (session.sessionCourses.length > 0 && studentId) {
      const courseSeasonId = session.sessionCourses[0].courseSeasonShift.courseSeasonId;
      const sessionStart = session.event.startDate;

      const membership = await this.prisma.studentMembership.findFirst({
        where: { studentId, courseSeasonId },
      });

      if (!membership) {
        throw new ForbiddenException('El estudiante no tiene una membresía activa para este curso.');
      }

      if (membership.status !== 'ACTIVE') {
        throw new ForbiddenException('El estudiante se encuentra suspendido o inactivo.');
      }

      const validEnrollment = await this.prisma.cycleEnrollment.findFirst({
        where: {
          studentMembershipId: membership.id,
          status: 'CONFIRMED',
          cycleStartDate: { lte: sessionStart },
          cycleEndDate: { gt: sessionStart },
        },
      });

      if (!validEnrollment) {
        throw new ForbiddenException('El estudiante no tiene un ciclo confirmado vigente para esta sesión.');
      }
    }

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
      sessionId,
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.SessionBookingWhereInput = {
      ...(sessionId ? { sessionId } : {}),
    };

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
        { session: { event: { title: { contains: search, mode: 'insensitive' } } } },
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

    const { isExternal, attended, chargeId } = updateSessionBookingDto;

    const updatedBooking = await this.prisma.sessionBooking.update({
      where: { id },
      data: {
        isExternal,
        attended,
        chargeId,
      },
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
