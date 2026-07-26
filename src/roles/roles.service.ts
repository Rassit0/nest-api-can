import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
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

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createRoleDto: CreateRoleDto) {
    const { name, description, permissionIds } = createRoleDto;

    if (permissionIds) {
      await this.validatePermissionsDependencies(permissionIds);
    }

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

    if (permissionIds) {
      await this.validatePermissionsDependencies(permissionIds);
    }

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

    // Invalida la caché de permisos de este rol
    await this.cacheManager.del(`role_${id}_access`);

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

    // Invalida la caché de permisos de este rol
    await this.cacheManager.del(`role_${id}_access`);

    return {
      message: 'Rol eliminado exitosamente',
      data: deletedRole,
    };
  }

  async getPermissionsArray(roleId: string, moduleName?: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: {
        permissions: {
          where: moduleName
            ? {
                permission: {
                  module: { name: moduleName },
                },
              }
            : undefined,
          select: {
            permission: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('El rol solicitado no fue encontrado');
    }

    const permissions = role.permissions.map((rp) => rp.permission.name);

    return {
      message: 'Permisos obtenidos exitosamente',
      data: permissions,
    };
  }

  async getPermissionsPaginated(paginationDto: any) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'module',
      roleId,
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.PermissionWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { module: { displayName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (roleId) {
      where.roles = {
        some: {
          roleId,
        },
      };
    }

    const [permissions, totalItems] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: {
          id: true,
          name: true,
          module: true,
        },
      }),
      this.prisma.permission.count({ where }),
    ]);

    return createPaginationResult(
      permissions,
      totalItems,
      page,
      per_page,
      'Permisos paginados obtenidos exitosamente',
    );
  }

  private async validatePermissionsDependencies(permissionIds: string[]) {
    if (!permissionIds || permissionIds.length === 0) return;

    // Obtener los detalles de los permisos solicitados
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: {
        name: true,
        module: { select: { name: true, displayName: true } },
      },
    });

    // Agrupar los permisos solicitados por módulo
    const permissionsByModule = permissions.reduce(
      (acc, perm) => {
        const modName = perm.module.name;
        if (!acc[modName]) acc[modName] = [];
        acc[modName].push(perm);
        return acc;
      },
      {} as Record<string, typeof permissions>,
    );

    // Validar cada módulo
    for (const [moduleName, perms] of Object.entries(permissionsByModule)) {
      // Si este módulo tiene una acción de modificación o un permiso personalizado...
      const hasModifyAction = perms.some(
        (p) => !p.name.startsWith('READ_') && p.name !== 'MANAGE_ALL',
      );

      // ...obligatoriamente debe tener una acción de lectura incluida en el array.
      const hasReadAction = perms.some((p) => p.name.startsWith('READ_'));

      if (hasModifyAction && !hasReadAction) {
        throw new BadRequestException(
          `El rol incluye permisos de modificación para el módulo '${perms[0].module.displayName}' pero no incluye el permiso de lectura (READ).`,
        );
      }
    }
  }
}
