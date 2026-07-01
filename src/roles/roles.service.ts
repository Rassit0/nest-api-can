import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { RolesPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const roleSelect: Prisma.RoleSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  permissions: {
    select: {
      permission: {
        select: {
          id: true,
          name: true,
          module: true,
        },
      },
    },
  },
};

@Injectable()
export class RolesService {
  private readonly logger = new Logger('RolesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createRoleDto: CreateRoleDto) {
    const { name, description, permissionIds } = createRoleDto;

    const newRole = await this.prisma.role.create({
      data: {
        name,
        description,
        permissions: permissionIds
          ? {
              create: permissionIds.map((id) => ({ permissionId: id })),
            }
          : undefined,
      },
      select: roleSelect,
    });

    return {
      message: 'Rol creado exitosamente',
      data: newRole,
    };
  }

  async findAll(paginationDto: RolesPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'name',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.RoleWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [roles, totalItems] = await Promise.all([
      this.prisma.role.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: roleSelect,
      }),
      this.prisma.role.count({ where }),
    ]);

    return createPaginationResult(
      roles,
      totalItems,
      page,
      per_page,
      'Roles obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: roleSelect,
    });
    if (!role) {
      throw new NotFoundException('El rol solicitado no fue encontrado');
    }
    return {
      message: 'Rol obtenido exitosamente',
      data: role,
    };
  }

  async update(id: string, updateRoleDto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });
    if (!role) {
      throw new NotFoundException('El rol solicitado no fue encontrado');
    }

    const { name, description, permissionIds } = updateRoleDto;

    const updatedRole = await this.prisma.$transaction(async (tx) => {
      if (permissionIds !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (permissionIds) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId: id,
              permissionId,
            })),
          });
        }
      }

      return await tx.role.update({
        where: { id },
        data: {
          name,
          description,
        },
        select: roleSelect,
      });
    });

    return {
      message: 'Rol actualizado exitosamente',
      data: updatedRole,
    };
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });
    if (!role) {
      throw new NotFoundException('El rol solicitado no fue encontrado');
    }

    const deletedRole = await this.prisma.role.delete({
      where: { id },
      select: roleSelect,
    });

    return {
      message: 'Rol eliminado exitosamente',
      data: deletedRole,
    };
  }
}
