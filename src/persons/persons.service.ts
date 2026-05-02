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

@Injectable()
export class PersonsService {
  private readonly logger = new Logger('PersonsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createPersonDto: CreatePersonDto) {
    try {
      const newPerson = await this.prisma.person.create({
        data: createPersonDto,
        // Esto es lo que hace "la magia" de devolver los datos relacionados
        include: {
          tutors: {
            select: {
              tutor: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  surName: true,
                  ci: true,
                  phone: true,
                  imageUrl: true,
                },
              }, // Trae los datos de la persona que es tutor
            },
          },
        },
      });

      return {
        message: 'Persona y tutores agregados exitosamente',
        data: newPerson,
      };
    } catch (error) {
      this.handleExceptions(error);
    }
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
            { id: { equals: Number(search) } },
            { name: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { surName: { contains: search, mode: 'insensitive' } },
            { ci: { contains: search, mode: 'insensitive' } },
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
        include: {
          tutors: {
            select: {
              tutor: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  surName: true,
                  ci: true,
                  phone: true,
                  imageUrl: true,
                },
              }, // Trae los datos de la persona que es tutor
            },
          },
        },
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
        // ¡Estos 2 valores ahorran mucho trabajo en el front!
        hasNextPage: page < Math.ceil(totalItems / per_page),
        hasPrevPage: page > 1,
      },
    };
  }

  async findOne(id: number) {
    const person = await this.prisma.person.findUnique({
      where: { id },
      include: {
        tutors: {
          select: {
            tutor: {
              select: {
                id: true,
                name: true,
                lastName: true,
                surName: true,
                ci: true,
                phone: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!person) {
      throw new NotFoundException('La persona no fue encontrada');
    }
    return { data: person, message: 'Persona encontrada exitosamente' };
  }

  async update(id: number, updatePersonDto: UpdatePersonDto) {
    try {
      const newPerson = await this.prisma.person.update({
        where: { id },
        data: updatePersonDto,
        // Esto es lo que hace "la magia" de devolver los datos relacionados
        include: {
          tutors: {
            select: {
              tutor: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  surName: true,
                  ci: true,
                  phone: true,
                  imageUrl: true,
                },
              }, // Trae los datos de la persona que es tutor
            },
          },
        },
      });

      return {
        message: 'Persona y tutores agregados exitosamente',
        data: newPerson,
      };
    } catch (error) {
      this.handleExceptions(error);
    }
  }

  remove(id: number) {
    return `This action removes a #${id} person`;
  }

  private handleExceptions(error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new NotFoundException('El recurso solicitado no fue encontrado');
      }
      const driverError = error.meta?.driverAdapterError as any;
      const fields = driverError.cause.constraint.fields;
      // console.log(fields); // [ 'title' ] o [ 'slug' ]
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Uno o más IDs de tutor proporcionados no existen en la base de datos.',
        );
      }
      // P2002 es el código para "Unique constraint failed"
      if (error.code === 'P2002') {
        throw new ConflictException({
          message: 'La Persona ya existe',
          statusCode: 409,
          errors: {
            ...fields.reduce((acc, field) => {
              acc[field] = `El CI está registrado`;
              return acc;
            }, {}),
          },
        });
      }
    }
    // 2. ERROR DE VALIDACIÓN DE PRISMA
    if (error instanceof Prisma.PrismaClientValidationError) {
      this.logger.error(
        'Error de validación de Prisma: Schema desactualizado o datos inválidos',
      );
      // Este error ocurre cuando la estructura del objeto no coincide con el schema
      throw new BadRequestException(
        'Error en la estructura de los datos enviados',
      );
    }

    // 3. Errores de Nest (como BadRequestException lanzados manualmente)
    if (error instanceof BadRequestException) {
      throw error;
    }

    // 4. Fallo genérico (Error de conexión, etc.)
    this.logger.error(error);
    throw new InternalServerErrorException('Error interno del servidor');
  }
}
