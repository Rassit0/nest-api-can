import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from 'src/prisma.service';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { MODULES_KEY } from '../../decorators/modules.decorator';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredModules = this.reflector.getAllAndOverride<string[]>(
      MODULES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no requiere ni permisos ni módulos específicos, dejamos pasar
    if (!requiredPermissions && !requiredModules) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado.');
    }

    // Si el usuario no tiene rol asignado, no puede pasar
    if (!user.roleId) {
      throw new ForbiddenException('No tienes un rol asignado.');
    }

    // Buscar en caché los permisos y módulos del rol
    const cacheKey = `role_${user.roleId}_access`;
    let roleAccess: { permissions: string[]; modules: string[] } | undefined =
      await this.cacheManager.get(cacheKey);

    if (!roleAccess) {
      // Si no está en caché, consultamos a la DB (1 sola vez por expiración)
      const role = await this.prisma.role.findUnique({
        where: { id: user.roleId },
        select: {
          permissions: {
            select: {
              permission: {
                select: { name: true, module: { select: { name: true } } },
              },
            },
          },
        },
      });

      if (!role) {
        throw new ForbiddenException('Tu rol ya no existe en el sistema.');
      }

      const permissions = role.permissions.map((rp) => rp.permission.name);
      // Mapeamos los módulos únicos
      const modulesSet = new Set<string>();
      role.permissions.forEach((rp) => {
        if (rp.permission.module) {
          modulesSet.add(rp.permission.module.name);
        }
      });
      const modules = Array.from(modulesSet);

      roleAccess = { permissions, modules };

      // Guardamos en caché (ej: 1 hora o hasta ser invalidado)
      await this.cacheManager.set(cacheKey, roleAccess, 3600000);
    }

    // Verificación de Módulos (Nivel Alto)
    if (requiredModules && requiredModules.length > 0) {
      const hasModule = requiredModules.some((mod) =>
        roleAccess.modules.includes(mod),
      );
      if (!hasModule) {
        throw new ForbiddenException(
          'No tienes acceso al módulo requerido para esta acción.',
        );
      }
    }

    // Verificación de Permisos (Nivel Fino)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.some((perm) =>
        roleAccess.permissions.includes(perm),
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          'No posees el permiso específico para esta acción.',
        );
      }
    }

    // Adjuntar los permisos al objeto user de la Request para comprobaciones granulares
    user.permissions = roleAccess.permissions;

    return true;
  }
}
