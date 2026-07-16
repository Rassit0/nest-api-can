import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { SchoolsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const schoolSelect: Prisma.SchoolSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  institution: {
    select: {
      id: true,
      name: true,
      address: true,
    },
  },
  discipline: {
    select: {
      id: true,
      name: true,
      icon: true,
    },
  },
};

@Injectable()
export class SchoolsService {
  private readonly logger = new Logger('SchoolsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createSchoolDto: CreateSchoolDto) {
    const institution = await this.prisma.institution.findFirst({
      select: {
        id: true,
      },
    });
    if (!institution) {
      throw new NotFoundException('La organización no fue encontrada');
    }
    const newSchool = await this.prisma.school.create({
      data: {
        ...createSchoolDto,
        institutionId: institution.id,
      },
      select: schoolSelect,
    });

    return {
      message: 'Escuela creada exitosamente',
      data: newSchool,
    };
  }

  async findAll(paginationDto: SchoolsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'name',
      disciplineId,
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.SchoolWhereInput = {};

    if (disciplineId) {
      where.disciplineId = disciplineId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        {
          institution: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          discipline: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [schools, totalItems] = await Promise.all([
      this.prisma.school.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: schoolSelect,
      }),
      this.prisma.school.count({ where }),
    ]);

    return createPaginationResult(
      schools,
      totalItems,
      page,
      per_page,
      'Escuelas obtenidas exitosamente',
    );
  }

  async findOne(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      select: schoolSelect,
    });
    if (!school) {
      throw new NotFoundException('La escuela solicitada no fue encontrada');
    }
    return {
      message: 'Escuela obtenida exitosamente',
      data: school,
    };
  }

  async update(id: string, updateSchoolDto: UpdateSchoolDto) {
    const school = await this.prisma.school.findUnique({
      where: { id },
    });
    if (!school) {
      throw new NotFoundException('La escuela solicitada no fue encontrada');
    }
    const institution = await this.prisma.institution.findFirst({
      select: {
        id: true,
      },
    });
    if (!institution) {
      throw new NotFoundException('La organización no fue encontrada');
    }

    const hasRelations = await this.prisma.courseSeason.findFirst({
      where: {
        course: {
          schoolId: id,
        },
      },
      select: {
        id: true,
      },
    });

    if (
      updateSchoolDto.disciplineId &&
      updateSchoolDto.disciplineId !== school.disciplineId &&
      hasRelations
    ) {
      throw new BadRequestException(
        'No se puede cambiar la disciplina porque la escuela tiene cursos y categorías relacionadas.',
      );
    }

    const updatedSchool = await this.prisma.school.update({
      where: { id },
      data: {
        ...updateSchoolDto,
        institutionId: institution.id,
      },
      select: schoolSelect,
    });

    return {
      message: 'Escuela actualizada exitosamente',
      data: updatedSchool,
    };
  }

  async remove(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
    });
    if (!school) {
      throw new NotFoundException('La escuela solicitada no fue encontrada');
    }

    const deletedSchool = await this.prisma.school.delete({
      where: { id },
      select: schoolSelect,
    });

    return {
      message: 'Escuela eliminada exitosamente',
      data: deletedSchool,
    };
  }

  async getSchoolsOptions() {
    const schools = await this.prisma.school.findMany({
      select: {
        id: true,
        name: true,
        discipline: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
    });

    return {
      data: schools,
      message: 'Escuelas obtenidas exitosamente',
    };
  }

  async getDisciplinesOptions() {
    const disciplines = await this.prisma.discipline.findMany({
      select: {
        id: true,
        name: true,
        icon: true,
      },
    });

    return {
      data: disciplines,
      message: 'Disciplinas obtenidas exitosamente',
    };
  }

  async getOrganizationsOptions() {
    const institutions = await this.prisma.institution.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    return {
      data: institutions,
      message: 'Organizaciones obtenidas exitosamente',
    };
  }
}
