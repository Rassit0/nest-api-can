import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { PersonPaginationDto } from './dto/pagination.dto';

export const PersonSelect: Prisma.PersonSelect = {
  id: true,
  name: true,
  lastName: true,
  secondLastName: true,
  imageUrl: true,
  address: true,
  phone: true,
  email: true,
  gender: true,
  birthDate: true,
  documentNumber: true,
  documentType: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class PersonsService {
  private readonly logger = new Logger('PersonsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createPersonDto: CreatePersonDto) {
    const { imageUrl, ...personData } = createPersonDto;
    const newPerson = await this.prisma.person.create({
      data: { ...personData },
      // Esto es lo que hace "la magia" de devolver los datos relacionados
      include: {},
    });

    return {
      message: 'Persona agregada exitosamente',
      data: newPerson,
    };
  }

  async findAll(paginationDto: PersonPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'name',
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.PersonWhereInput = search
      ? {
          OR: [
            // ({ id: { equals: Number(search) } }),
            { name: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { secondLastName: { contains: search, mode: 'insensitive' } },
            { documentNumber: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [persons, totalItems] = await Promise.all([
      this.prisma.person.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: PersonSelect,
      }),
      this.prisma.person.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      data: persons, // Será [] si la página no existe o no hay registros
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
    const person = await this.prisma.person.findUnique({
      where: { id },
      select: PersonSelect,
    });

    if (!person) {
      throw new NotFoundException('La persona no fue encontrada');
    }
    return { data: person, message: 'Persona encontrada exitosamente' };
  }

  async update(id: string, updatePersonDto: UpdatePersonDto) {
    const { imageUrl, ...personData } = updatePersonDto;
    const newPerson = await this.prisma.person.update({
      where: { id },
      data: { ...personData },
      select: PersonSelect,
    });

    return {
      message: 'Persona actualizada exitosamente',
      data: newPerson,
    };
  }

  async getSecretarySummary(personId: string) {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: {
        players: true,
        students: true,
      },
    });

    if (!person) {
      throw new NotFoundException('La persona no fue encontrada');
    }

    const [playerMemberships, studentMemberships, charges] = await Promise.all([
      // 1. Active Player Memberships
      person.players?.id
        ? this.prisma.playerMembership.findMany({
            where: {
              playerId: person.players.id,
              status: { notIn: ['WITHDRAWN', 'FINISHED'] },
            },
            include: {
              teamSeasonCategories: {
                include: {
                  teamSeason: {
                    include: { team: true },
                  },
                  category: {
                    include: { discipline: true },
                  },
                },
              },
            },
            orderBy: { startedAt: 'desc' },
          })
        : Promise.resolve([]),

      // 2. Active Student Memberships
      person.students?.id
        ? this.prisma.studentMembership.findMany({
            where: {
              studentId: person.students.id,
              status: { notIn: ['WITHDRAWN', 'FINISHED'] },
            },
            include: {
              courseSeason: {
                include: {
                  course: true,
                  season: {
                    include: { institution: true },
                  },
                },
              },
            },
            orderBy: { startedAt: 'desc' },
          })
        : Promise.resolve([]),

      // 3. Pending Charges
      this.prisma.charge.findMany({
        where: {
          pendingAmount: { gt: 0 },
          status: { not: 'CANCELLED' },
          OR: [
            {
              accountCharge: {
                personId,
              },
            },
            {
              membershipCharges: {
                some: {
                  playerMembership: {
                    player: {
                      personId,
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
                      personId,
                    },
                  },
                },
              },
            },
          ],
        },
        include: {
          accountCharge: {
            include: { category: true },
          },
          membershipCharges: {
            include: {
              playerMembership: {
                include: {
                  teamSeasonCategories: {
                    include: {
                      teamSeason: { include: { team: true } },
                      category: { include: { discipline: true } },
                    },
                  },
                },
              },
            },
          },
          studentCharges: {
            include: {
              studentMembership: {
                include: {
                  courseSeason: {
                    include: { course: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    return {
      message: 'Resumen de secretaría obtenido exitosamente',
      data: {
        profile: {
          id: person.id,
          name: person.name,
          lastName: person.lastName,
          secondLastName: person.secondLastName,
          documentNumber: person.documentNumber,
          phone: person.phone,
          email: person.email,
          imageUrl: person.imageUrl,
          playerId: person.players?.id,
          studentId: person.students?.id,
        },
        playerMemberships: playerMemberships.map((pm) => ({
          id: pm.id,
          disciplineName: pm.teamSeasonCategories.category.discipline.name,
          categoryName: pm.teamSeasonCategories.category.name,
          teamName: pm.teamSeasonCategories.teamSeason.team.name,
          status: pm.status,
          startedAt: pm.startedAt,
        })),
        studentMemberships: studentMemberships.map((sm) => ({
          id: sm.id,
          courseName: sm.courseSeason.course.name,
          institutionName: sm.courseSeason.season.institution.name,
          status: sm.status,
          startedAt: sm.startedAt,
        })),
        pendingCharges: charges.map((charge) => {
          let type = 'ACCOUNT';
          let originName = 'Cobro Manual';

          if (charge.membershipCharges.length > 0) {
            type = 'MEMBERSHIP';
            const pm = charge.membershipCharges[0].playerMembership;
            originName = `${pm.teamSeasonCategories.teamSeason.team.name} - ${pm.teamSeasonCategories.category.name}`;
          } else if (charge.studentCharges.length > 0) {
            type = 'STUDENT';
            const sm = charge.studentCharges[0].studentMembership;
            originName = sm.courseSeason.course.name;
          } else if (charge.accountCharge) {
            originName = charge.accountCharge.category?.name || charge.accountCharge.title || 'Cobro Manual';
          }

          return {
            id: charge.id,
            description: charge.description,
            amount: Number(charge.amount),
            pendingAmount: Number(charge.pendingAmount),
            adjustmentAmount: Number(charge.adjustmentAmount),
            adjustmentReason: charge.adjustmentReason,
            dueDate: charge.dueDate,
            status: charge.status,
            type,
            originName,
          };
        }),
      },
    };
  }

  remove(id: string) {
    return `This action removes a #${id} person`;
  }
}
