import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateSessionIncidentDto } from './dto/create-session-incident.dto';
import { UpdateSessionIncidentDto } from './dto/update-session-incident.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { SessionIncidentsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const sessionIncidentSelect: Prisma.SessionIncidentSelect = {
  id: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  sessionBooking: {
    select: {
      id: true,
      attended: true,
      session: {
        select: {
          id: true,
          dateTime: true,
          title: true,
        },
      },
      player: {
        select: {
          id: true,
          person: {
            select: {
              id: true,
              name: true,
              lastName: true,
            },
          },
        },
      },
      student: {
        select: {
          id: true,
          person: {
            select: {
              id: true,
              name: true,
              lastName: true,
            },
          },
        },
      },
    },
  },
};

@Injectable()
export class SessionIncidentsService {
  private readonly logger = new Logger('SessionIncidentsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createSessionIncidentDto: CreateSessionIncidentDto) {
    const newIncident = await this.prisma.sessionIncident.create({
      data: createSessionIncidentDto,
      select: sessionIncidentSelect,
    });

    return {
      message: 'Incidente de mala conducta registrado exitosamente',
      data: newIncident,
    };
  }

  async findAll(paginationDto: SessionIncidentsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.SessionIncidentWhereInput = {};

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        {
          sessionBooking: {
            OR: [
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
                student: {
                  person: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      ];
    }

    const [incidents, totalItems] = await Promise.all([
      this.prisma.sessionIncident.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: sessionIncidentSelect,
      }),
      this.prisma.sessionIncident.count({ where }),
    ]);

    return createPaginationResult(
      incidents,
      totalItems,
      page,
      per_page,
      'Incidentes de conducta obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const incident = await this.prisma.sessionIncident.findUnique({
      where: { id },
      select: sessionIncidentSelect,
    });
    if (!incident) {
      throw new NotFoundException('El incidente solicitado no fue encontrado');
    }
    return {
      message: 'Incidente de conducta obtenido exitosamente',
      data: incident,
    };
  }

  async update(id: string, updateSessionIncidentDto: UpdateSessionIncidentDto) {
    const incident = await this.prisma.sessionIncident.findUnique({
      where: { id },
    });
    if (!incident) {
      throw new NotFoundException('El incidente solicitado no fue encontrado');
    }

    const updatedIncident = await this.prisma.sessionIncident.update({
      where: { id },
      data: updateSessionIncidentDto,
      select: sessionIncidentSelect,
    });

    return {
      message: 'Incidente de conducta actualizado exitosamente',
      data: updatedIncident,
    };
  }

  async remove(id: string) {
    const incident = await this.prisma.sessionIncident.findUnique({
      where: { id },
    });
    if (!incident) {
      throw new NotFoundException('El incidente solicitado no fue encontrado');
    }

    const deletedIncident = await this.prisma.sessionIncident.delete({
      where: { id },
      select: sessionIncidentSelect,
    });

    return {
      message: 'Incidente de conducta eliminado exitosamente',
      data: deletedIncident,
    };
  }
}
