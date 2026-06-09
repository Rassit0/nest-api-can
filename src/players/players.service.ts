import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { PlayerPaginationDto } from './dto/pagination.dto';

export const PersonSelect: Prisma.PersonSelect = {
  id: true,
  name: true,
  lastName: true,
  secondLastName: true,
  birthDate: true,
  imageUrl: true,
  documentType: true,
  documentNumber: true,
  phone: true,
  email: true,
  address: true,
  gender: true,
  createdAt: true,
  updatedAt: true,
};

export const PlayerSelect: Prisma.PlayerSelect = {
  id: true,
  person: {
    select: PersonSelect,
  },
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class PlayersService {
  private readonly logger = new Logger('PersonsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createPlayerDto: CreatePlayerDto) {
    const { imageUrl, isActive, ...personData } = createPlayerDto;
    const newPerson = await this.prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: personData,
      });

      const player = await tx.player.create({
        data: {
          personId: person.id,
          isActive,
        },
        select: PlayerSelect,
      });

      return player;
    });

    return {
      message: 'Jugador creado exitosamente',
      data: newPerson,
    };
  }

  async findAll(paginationDto: PlayerPaginationDto) {
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
    const [players, totalItems] = await Promise.all([
      this.prisma.player.findMany({
        where: {
          person: where,
        },
        take: per_page,
        skip,
        orderBy: {
          person: {
            [sortField]: orderBy,
          },
        },
        select: PlayerSelect,
      }),
      this.prisma.player.count({ where: { person: where } }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      message: 'Jugadores obtenidos exitosamente',
      data: players, // Será [] si la página no existe o no hay registros
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
    const player = await this.prisma.player.findUnique({
      where: {
        id,
      },
      select: PlayerSelect,
    });
    if (!player) {
      throw new NotFoundException('Jugador no encontrado');
    }
    return {
      message: 'Jugador obtenido exitosamente',
      data: player,
    };
  }

  async update(id: string, updatePlayerDto: UpdatePlayerDto) {
    const { imageUrl, isActive, ...personData } = updatePlayerDto;
    const player = await this.findOne(id);

    const updatedPlayer = await this.prisma.$transaction(async (tx) => {
      const [passesCount, membershipsCount] = await Promise.all([
        tx.playerPass.count({
          where: { playerId: id },
        }),
        tx.teamMembership.count({
          where: { playerId: id },
        }),
      ]);

      if (
        updatePlayerDto.gender &&
        updatePlayerDto.gender !== player.data.person.gender &&
        (passesCount > 0 || membershipsCount > 0)
      ) {
        throw new BadRequestException(
          'No es posible modificar el género porque el jugador ya posee pases o inscripciones registradas',
        );
      }

      const person = await tx.person.update({
        where: {
          id: player.data.person.id,
        },
        data: personData,
      });

      return await tx.player.update({
        where: {
          id,
        },
        data: {
          personId: person.id,
          isActive,
        },
        select: PlayerSelect,
      });
    });

    return {
      message: 'Jugador actualizado exitosamente',
      data: updatedPlayer,
    };
  }

  async remove(id: string) {
    return `This action removes a #${id} player`;
  }
}
