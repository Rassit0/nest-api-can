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
  imageUrl: true,
  address: true,
  phone: true,
  email: true,
  contacts: {
    select: {
      relationship: true,
      isPrimaryContact: true,
      isEmergencyContact: true,
      isBillingContact: true,
      contactPerson: {
        select: {
          id: true,
          name: true,
          lastName: true,
          secondLastName: true,
          documentType: true,
          documentNumber: true,
          phone: true,
          email: true,
        },
      },
    },
  },
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
      message: 'Persona y tutores agregados exitosamente',
      data: newPerson,
    };
  }

  remove(id: string) {
    return `This action removes a #${id} person`;
  }
}
