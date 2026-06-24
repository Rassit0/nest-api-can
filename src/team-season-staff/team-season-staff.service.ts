import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateTeamSeasonStaffDto } from './dto/create-team-season-staff.dto';
import { UpdateTeamSeasonStaffDto } from './dto/update-team-season-staff.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { TeamSeasonStaffPaginationDto } from './dto/pagination.dto';

export const teamSeasonStaffSelect: Prisma.TeamSeasonStaffSelect = {
  id: true,
  teamSeasonId: true,
  staffId: true,
  role: true,
  customRole: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class TeamSeasonStaffService {
  private readonly logger = new Logger('SeasonsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createTeamSeasonStaffDto: CreateTeamSeasonStaffDto) {
    const newSeason = await this.prisma.teamSeasonStaff.create({
      data: createTeamSeasonStaffDto,
      select: teamSeasonStaffSelect,
    });

    return {
      message: 'Personal agregado exitosamente',
      data: newSeason,
    };
  }

  async findAll(paginationDto: TeamSeasonStaffPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      staffId,
      teamSeasonId,
      role,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.TeamSeasonStaffWhereInput = {};

    if (teamSeasonId) {
      where.teamSeasonId = teamSeasonId;
    }

    if (staffId) {
      where.staffId = staffId;
    }

    if (role) {
      where.role = role;
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [teamSeasonStaffs, totalItems] = await Promise.all([
      this.prisma.teamSeasonStaff.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: teamSeasonStaffSelect,
      }),
      this.prisma.teamSeasonStaff.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      message: 'Personal del equipo obtenido exitosamente',
      data: teamSeasonStaffs, // Será [] si la página no existe o no hay registros
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
    const teamSeasonStaff = await this.prisma.teamSeasonStaff.findUnique({
      where: { id },
      select: teamSeasonStaffSelect,
    });
    if (!teamSeasonStaff) {
      throw new NotFoundException('El personal del equipo no fue encontrado');
    }
    return {
      data: teamSeasonStaff,
      message: 'Personal del equipo obtenido exitosamente',
    };
  }

  async update(id: string, updateTeamSeasonStaffDto: UpdateTeamSeasonStaffDto) {
    const teamSeasonStaff = await this.prisma.teamSeasonStaff.findUnique({
      where: { id },
      select: teamSeasonStaffSelect,
    });
    if (!teamSeasonStaff) {
      throw new NotFoundException('El personal del equipo no fue encontrado');
    }
    const updatedTeamSeasonStaff = await this.prisma.teamSeasonStaff.update({
      where: { id },
      data: updateTeamSeasonStaffDto,
      select: teamSeasonStaffSelect,
    });
    return {
      message: 'Personal del equipo actualizado exitosamente',
      data: updatedTeamSeasonStaff,
    };
  }

  async remove(id: string) {
    const teamSeasonStaff = await this.prisma.teamSeasonStaff.findUnique({
      where: { id },
      select: teamSeasonStaffSelect,
    });
    if (!teamSeasonStaff) {
      throw new NotFoundException('El personal del equipo no fue encontrado');
    }
    const deletedTeamSeasonStaff = await this.prisma.teamSeasonStaff.delete({
      where: { id },
      select: teamSeasonStaffSelect,
    });
    return {
      message: 'Personal del equipo eliminado exitosamente',
      data: deletedTeamSeasonStaff,
    };
  }
}
