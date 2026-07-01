import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { PermissionsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const permissionSelect: Prisma.PermissionSelect = {
  id: true,
  name: true,
  module: true,
  description: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger('PermissionsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createPermissionDto: CreatePermissionDto) {
    const newPermission = await this.prisma.permission.create({
      data: createPermissionDto,
      select: permissionSelect,
    });

    return {
      message: 'Permiso creado exitosamente',
      data: newPermission,
    };
  }

  async findAll(paginationDto: PermissionsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'name',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.PermissionWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { module: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [permissions, totalItems] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: permissionSelect,
      }),
      this.prisma.permission.count({ where }),
    ]);

    return createPaginationResult(
      permissions,
      totalItems,
      page,
      per_page,
      'Permisos obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
      select: permissionSelect,
    });
    if (!permission) {
      throw new NotFoundException('El permiso solicitado no fue encontrado');
    }
    return {
      message: 'Permiso obtenido exitosamente',
      data: permission,
    };
  }

  async update(id: string, updatePermissionDto: UpdatePermissionDto) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException('El permiso solicitado no fue encontrado');
    }

    const updatedPermission = await this.prisma.permission.update({
      where: { id },
      data: updatePermissionDto,
      select: permissionSelect,
    });

    return {
      message: 'Permiso actualizado exitosamente',
      data: updatedPermission,
    };
  }

  async remove(id: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException('El permiso solicitado no fue encontrado');
    }

    const deletedPermission = await this.prisma.permission.delete({
      where: { id },
      select: permissionSelect,
    });

    return {
      message: 'Permiso eliminado exitosamente',
      data: deletedPermission,
    };
  }
}
