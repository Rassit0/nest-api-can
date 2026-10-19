import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { StaffPaginationDto } from './dto/pagination.dto';

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

export const StaffSelect: Prisma.StaffSelect = {
  id: true,
  person: {
    select: PersonSelect,
  },
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createStaffDto: CreateStaffDto, actor?: any) {
    const existingStaff = await this.prisma.staff.findUnique({
      where: {
        personId: createStaffDto.personId,
      },
    });

    if (existingStaff) {
      throw new ConflictException(
        'Esta persona ya se encuentra registrada como miembro del personal.',
      );
    }

    const newStaff = await this.prisma.staff.create({
      data: {
        personId: createStaffDto.personId,
        isActive: createStaffDto.isActive ?? true,
        createdById: actor?.id ?? null,
      },
      select: StaffSelect,
    });

    return {
      message: 'Personal creado exitosamente',
      data: newStaff,
    };
  }

  async findAll(paginationDto: StaffPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'name',
      status,
    } = paginationDto;

    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    let isActiveFilter: boolean | undefined = undefined;
    if (status) {
      const normalizedStatus = status.toUpperCase();
      if (normalizedStatus === 'ACTIVE') {
        isActiveFilter = true;
      } else if (normalizedStatus === 'INACTIVE') {
        isActiveFilter = false;
      }
    }

    const where: Prisma.StaffWhereInput = {
      ...(isActiveFilter !== undefined ? { isActive: isActiveFilter } : {}),
      ...(search
        ? {
            OR: [
              { id: { equals: search } },
              { person: { name: { contains: search, mode: 'insensitive' } } },
              { person: { lastName: { contains: search, mode: 'insensitive' } } },
              {
                person: {
                  secondLastName: { contains: search, mode: 'insensitive' },
                },
              },
              {
                person: {
                  documentNumber: { contains: search, mode: 'insensitive' },
                },
              },
              { person: { phone: { contains: search, mode: 'insensitive' } } },
              { person: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const directStaffSortFields = ['isActive', 'createdAt', 'id'];
    const orderByClause: Prisma.StaffOrderByWithRelationInput =
      directStaffSortFields.includes(sortField)
        ? { [sortField]: orderBy }
        : {
            person: {
              [sortField]: orderBy,
            },
          };

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [staff, totalItems] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        take: per_page,
        skip,
        orderBy: orderByClause,
        select: StaffSelect,
      }),
      this.prisma.staff.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      message: 'Personal obtenido exitosamente',
      data: staff,
      meta: {
        totalItems,
        itemsPerPage: per_page,
        totalPages,
        currentPage,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  }

  async findOne(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: {
        id,
      },
      select: StaffSelect,
    });
    if (!staff) {
      throw new NotFoundException('Personal no encontrado');
    }
    return {
      message: 'Personal obtenido exitosamente',
      data: staff,
    };
  }

  async update(id: string, updateStaffDto: UpdateStaffDto, actor?: any) {
    const staff = await this.prisma.staff.findUnique({
      where: {
        id,
      },
      select: StaffSelect,
    });
    if (!staff) {
      throw new NotFoundException('Personal no encontrado');
    }
    const updatedStaff = await this.prisma.staff.update({
      where: {
        id,
      },
      data: {
        ...updateStaffDto,
        updatedById: actor?.id ?? undefined,
      },
      select: StaffSelect,
    });

    return {
      message: 'Personal actualizado exitosamente',
      data: updatedStaff,
    };
  }

  async deactivate(id: string, actor?: any) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
    });
    if (!staff) {
      throw new NotFoundException('Personal no encontrado');
    }

    const updatedStaff = await this.prisma.staff.update({
      where: { id },
      data: {
        isActive: false,
        updatedById: actor?.id ?? undefined,
      },
      select: StaffSelect,
    });

    return {
      message: 'Personal desactivado exitosamente',
      data: updatedStaff,
    };
  }

  async reactivate(id: string, actor?: any) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
    });
    if (!staff) {
      throw new NotFoundException('Personal no encontrado');
    }

    const updatedStaff = await this.prisma.staff.update({
      where: { id },
      data: {
        isActive: true,
        updatedById: actor?.id ?? undefined,
      },
      select: StaffSelect,
    });

    return {
      message: 'Personal reactivado exitosamente',
      data: updatedStaff,
    };
  }

  async remove(id: string, actor?: any) {
    // Desactivación lógica obligatoria para preservar trazabilidad histórica
    return this.deactivate(id, actor);
  }
}
