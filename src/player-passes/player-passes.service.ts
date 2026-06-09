import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatePlayerPassDto } from './dto/create-player-pass.dto';
import { UpdatePlayerPassDto } from './dto/update-player-pass.dto';
import {
  Gender,
  PassOriginType,
  PlayerPassStatus,
  PreviousTeamSource,
  Prisma,
} from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { PlayerPassesPaginationDto } from './dto/pagination.dto';

export const playerPassSelect: Prisma.PlayerPassSelect = {
  id: true,
  player: {
    select: {
      id: true,
      person: {
        select: {
          imageUrl: true,
          name: true,
          lastName: true,
          secondLastName: true,
          birthDate: true,
          documentType: true,
          documentNumber: true,
          gender: true,
          email: true,
          phone: true,
        },
      },
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  externalPreviousTeamName: true,
  previousTeam: {
    select: {
      id: true,
      name: true,
      club: {
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
      },
    },
  },
  currentTeam: {
    select: {
      id: true,
      name: true,
      club: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  originType: true,
  startDate: true,
  endDate: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class PlayerPassesService {
  private readonly logger = new Logger('PlayerPassesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createPlayerPassDto: CreatePlayerPassDto) {
    if (createPlayerPassDto.previousTeamId) {
      const [previousTeam, currentTeam] = await Promise.all([
        this.prisma.team.findUnique({
          where: {
            id: createPlayerPassDto.previousTeamId,
          },
          select: {
            clubId: true,
            club: {
              select: {
                disciplineId: true,
              },
            },
          },
        }),

        this.prisma.team.findUnique({
          where: {
            id: createPlayerPassDto.currentTeamId,
          },
          select: {
            clubId: true,
            club: {
              select: {
                disciplineId: true,
              },
            },
          },
        }),
      ]);

      if (previousTeam?.club.disciplineId !== currentTeam?.club.disciplineId) {
        throw new BadRequestException(
          'El equipo origen debe pertenecer a la misma disciplina',
        );
      }

      const sameClub = previousTeam?.clubId === currentTeam?.clubId;
      if (
        createPlayerPassDto.originType === PassOriginType.INTERNAL &&
        !sameClub
      ) {
        throw new BadRequestException(
          'Un pase interno debe realizarse entre equipos del mismo club',
        );
      }
      if (
        createPlayerPassDto.originType === PassOriginType.EXTERNAL &&
        createPlayerPassDto.previousTeamSource === PreviousTeamSource.SYSTEM &&
        sameClub
      ) {
        throw new BadRequestException(
          'Un pase externo debe realizarse entre clubes diferentes',
        );
      }
    }

    const newPlayerPass = await this.prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({
        where: {
          id: createPlayerPassDto.playerId,
        },
        include: {
          person: true,
        },
      });

      if (!player) {
        throw new NotFoundException('Jugador no encontrado');
      }

      const currentTeam = await tx.team.findUnique({
        where: {
          id: createPlayerPassDto.currentTeamId,
        },
        include: {
          club: true,
        },
      });

      if (!currentTeam) {
        throw new NotFoundException('Equipo actual no encontrado');
      }

      if (player.person.gender !== currentTeam.gender) {
        throw new BadRequestException(
          'El genero del jugador no coincide con el genero del equipo',
        );
      }

      if (!player.person.birthDate) {
        throw new BadRequestException(
          'El jugador no tiene fecha de nacimiento',
        );
      }
      // Validar que la edad del jugador este dentro del rango de edad del equipo
      const age = calculateAge(player.person.birthDate);

      if (age < currentTeam.minAge || age > currentTeam.maxAge) {
        throw new BadRequestException(
          'La edad del jugador no coincide con la edad del equipo',
        );
      }

      const prevPlayerPass = await tx.playerPass.findFirst({
        where: {
          playerId: createPlayerPassDto.playerId,
          status: PlayerPassStatus.ACTIVE,
        },
      });
      if (prevPlayerPass) {
        await tx.playerPass.update({
          where: {
            id: prevPlayerPass.id,
          },
          data: {
            status: PlayerPassStatus.INACTIVE,
          },
        });
      }
      return await tx.playerPass.create({
        data: {
          ...createPlayerPassDto,
          status: PlayerPassStatus.ACTIVE,
        },
        select: playerPassSelect,
      });
    });
    return {
      message: 'Pase de jugador agregado exitosamente',
      data: newPlayerPass,
    };
  }

  async findAll(paginationDto: PlayerPassesPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      playerId,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.PlayerPassWhereInput = search
      ? {
          OR: [
            {
              player: {
                person: { name: { contains: search, mode: 'insensitive' } },
              },
            },
            {
              player: {
                person: { lastName: { contains: search, mode: 'insensitive' } },
              },
            },
            {
              player: {
                person: {
                  secondLastName: { contains: search, mode: 'insensitive' },
                },
              },
            },
            {
              player: {
                person: {
                  documentNumber: { contains: search, mode: 'insensitive' },
                },
              },
            },
            {
              player: {
                person: { phone: { contains: search, mode: 'insensitive' } },
              },
            },
            {
              player: {
                person: { email: { contains: search, mode: 'insensitive' } },
              },
            },
            {
              externalPreviousTeamName: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              previousTeam: { name: { contains: search, mode: 'insensitive' } },
            },
            {
              previousTeam: {
                club: { name: { contains: search, mode: 'insensitive' } },
              },
            },
            {
              currentTeam: { name: { contains: search, mode: 'insensitive' } },
            },
            {
              currentTeam: {
                club: { name: { contains: search, mode: 'insensitive' } },
              },
            },
          ],
        }
      : {};

    if (paginationDto.status !== 'all') {
      where.status = paginationDto.status;
    }

    if (playerId) {
      where.playerId = playerId;
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [playerPasses, totalItems] = await Promise.all([
      this.prisma.playerPass.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: playerPassSelect,
      }),
      this.prisma.playerPass.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      data: playerPasses, // Será [] si la página no existe o no hay registros
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

  async playerPassesByPlayerId(
    playerId: string,
    paginationDto: PlayerPassesPaginationDto,
  ) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.PlayerPassWhereInput = search
      ? {
          OR: [
            {
              player: {
                person: { name: { contains: search, mode: 'insensitive' } },
              },
            },
            {
              player: {
                person: { lastName: { contains: search, mode: 'insensitive' } },
              },
            },
            {
              player: {
                person: {
                  secondLastName: { contains: search, mode: 'insensitive' },
                },
              },
            },
            {
              player: {
                person: {
                  documentNumber: { contains: search, mode: 'insensitive' },
                },
              },
            },
            {
              player: {
                person: { phone: { contains: search, mode: 'insensitive' } },
              },
            },
            {
              player: {
                person: { email: { contains: search, mode: 'insensitive' } },
              },
            },
            {
              externalPreviousTeamName: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              previousTeam: { name: { contains: search, mode: 'insensitive' } },
            },
            {
              previousTeam: {
                club: { name: { contains: search, mode: 'insensitive' } },
              },
            },
            {
              currentTeam: { name: { contains: search, mode: 'insensitive' } },
            },
            {
              currentTeam: {
                club: { name: { contains: search, mode: 'insensitive' } },
              },
            },
          ],
        }
      : {};

    if (paginationDto.status !== 'all') {
      where.status = paginationDto.status;
    }

    where.playerId = playerId;

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [playerPasses, totalItems] = await Promise.all([
      this.prisma.playerPass.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: playerPassSelect,
      }),
      this.prisma.playerPass.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      data: playerPasses, // Será [] si la página no existe o no hay registros
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
    const playerPass = await this.prisma.playerPass.findUnique({
      where: { id },
      select: playerPassSelect,
    });
    if (!playerPass) {
      throw new NotFoundException('El pase de jugador no fue encontrado');
    }
    return {
      data: playerPass,
      message: 'Pase de jugador obtenido exitosamente',
    };
  }

  async update(id: string, updatePlayerPassDto: UpdatePlayerPassDto) {
    await this.findOne(id);

    const updatedPlayerPass = await this.prisma.playerPass.update({
      where: { id },
      data: updatePlayerPassDto,
      select: playerPassSelect,
    });
    return {
      message: 'Pase de jugador actualizado exitosamente',
      data: updatedPlayerPass,
    };
  }

  async remove(id: string) {
    await this.findOne(id);

    const deletedPlayerPass = await this.prisma.playerPass.delete({
      where: { id },
    });

    return {
      data: deletedPlayerPass,
      message: 'Pase de jugador eliminado exitosamente',
    };
  }

  async getPlayerPassActiveOptions() {
    const playerPasses = await this.prisma.playerPass.findMany({
      where: {
        status: PlayerPassStatus.ACTIVE,
      },
      select: {
        id: true,
        currentTeam: {
          select: {
            id: true,
            name: true,
            club: {
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
            },
          },
        },
      },
    });

    return {
      data: playerPasses,
      message: 'Pases de jugador obtenidos exitosamente',
    };
  }

  async getPlayerPassActiveByPlayerByDisciplineOptions(
    playerId: string,
    disciplineId: string,
  ) {
    const playerPasses = await this.prisma.playerPass.findMany({
      where: {
        status: PlayerPassStatus.ACTIVE,
        playerId,
        currentTeam: {
          club: {
            disciplineId,
          },
        },
      },
      select: {
        id: true,
        currentTeam: {
          select: {
            id: true,
            name: true,
            club: {
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
            },
          },
        },
      },
    });

    return {
      data: playerPasses,
      message: 'Pases de jugador obtenidos exitosamente',
    };
  }

  async getClubsByDisciplineOptions(disciplineId: string) {
    const clubs = await this.prisma.club.findMany({
      where: {
        disciplineId,
      },
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
      data: clubs,
      message: 'Clubes obtenidos exitosamente',
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

  async getTeamsByClubByGenderOptions(clubId: string, gender: Gender) {
    const teams = await this.prisma.team.findMany({
      where: {
        clubId,
        gender,
      },
      select: {
        id: true,
        name: true,
        gender: true,
      },
    });

    return {
      data: teams,
      message: 'Equipos obtenidos exitosamente',
    };
  }
}

function calculateAge(birthDate: Date): number {
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();

  // Si el mes actual es menor al mes de nacimiento, o si es el mismo mes pero el día actual es menor al día de nacimiento, se resta 1 al año
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}
