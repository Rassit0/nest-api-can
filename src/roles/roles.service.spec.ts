import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { PrismaService } from 'src/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';

describe('RolesService (Security)', () => {
  let service: RolesService;
  let prisma: PrismaService;
  let cacheManager: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: PrismaService,
          useValue: {
            permission: {
              findMany: jest.fn(),
            },
            role: {
              findUnique: jest.fn(),
              delete: jest.fn(),
              create: jest.fn(),
            },
            user: {
              count: jest.fn(),
            },
            $transaction: jest.fn(async (cb) => {
              return cb({
                rolePermission: {
                  deleteMany: jest.fn(),
                  createMany: jest.fn(),
                },
                role: {
                  update: jest.fn(),
                },
              });
            }),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    prisma = module.get<PrismaService>(PrismaService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  describe('RBAC Delegation', () => {
    const createDto = {
      name: 'New Role',
      description: 'Test',
      permissionIds: ['perm-A', 'perm-B', 'perm-C'],
    };

    it('Caso D: Should forbid non-superadmin from delegating permissions they do not have', async () => {
      const actor = {
        role: { isSuperAdmin: false },
        permissions: ['READ_A', 'WRITE_A'], // Only A
      };

      // Both validatePermissionsDependencies and enforceRbacDelegation will use this mock
      jest.spyOn(prisma.permission, 'findMany').mockResolvedValue([
        { name: 'READ_A', module: { name: 'A', displayName: 'A' } },
        { name: 'WRITE_A', module: { name: 'A', displayName: 'A' } },
        { name: 'READ_C', module: { name: 'C', displayName: 'C' } },
      ] as any);

      await expect(service.create(createDto, actor)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(createDto, actor)).rejects.toThrow(
        `Delegación de permisos denegada: No posees el permiso 'READ_C' que intentas conceder.`
      );
    });

    it('Caso E: Should allow non-superadmin to delegate permissions they DO have', async () => {
      const actor = {
        role: { isSuperAdmin: false },
        permissions: ['READ_A', 'WRITE_A', 'READ_C'],
      };

      jest.spyOn(prisma.permission, 'findMany').mockResolvedValue([
        { name: 'READ_A', module: { name: 'A', displayName: 'A' } },
        { name: 'WRITE_A', module: { name: 'A', displayName: 'A' } },
      ] as any);

      jest.spyOn(prisma.role, 'create').mockResolvedValue({ id: 'new-role-id' } as any);

      const validDto = { ...createDto, permissionIds: ['perm-A', 'perm-B'] };
      const result = await service.create(validDto, actor);

      expect(result.message).toBe('Rol creado exitosamente');
      expect(prisma.role.create).toHaveBeenCalled();
    });

    it('Caso F: Should allow SuperAdmin to delegate permissions exceeding their own', async () => {
      const actor = {
        role: { isSuperAdmin: true },
        permissions: [], // Empty permissions, but is superadmin
      };

      jest.spyOn(prisma.permission, 'findMany').mockResolvedValue([
        { name: 'READ_A', module: { name: 'A', displayName: 'A' } },
        { name: 'WRITE_A', module: { name: 'A', displayName: 'A' } },
        { name: 'READ_C', module: { name: 'C', displayName: 'C' } },
      ] as any);

      // enforceRbacDelegation shouldn't even call findMany for names because it bypasses early
      jest.spyOn(prisma.role, 'create').mockResolvedValue({ id: 'new-role-id' } as any);

      const result = await service.create(createDto, actor);

      expect(result.message).toBe('Rol creado exitosamente');
      expect(prisma.role.create).toHaveBeenCalled();
    });
  });

  describe('Role Protection', () => {
    const actor = { id: 'admin-id' };

    it('Caso G: Should forbid deleting a system role', async () => {
      jest.spyOn(prisma.role, 'findUnique').mockResolvedValue({
        id: 'system-role',
        isSystem: true,
      } as any);

      await expect(service.remove('system-role', actor)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.remove('system-role', actor)).rejects.toThrow(
        'No se pueden eliminar roles protegidos por el sistema'
      );
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });

    it('Caso H: Should forbid deleting a role with associated users', async () => {
      jest.spyOn(prisma.role, 'findUnique').mockResolvedValue({
        id: 'normal-role',
        isSystem: false,
      } as any);
      jest.spyOn(prisma.user, 'count').mockResolvedValue(1); // Users exist

      await expect(service.remove('normal-role', actor)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.remove('normal-role', actor)).rejects.toThrow(
        'No se puede eliminar un rol que tiene usuarios asignados'
      );
      expect(prisma.role.delete).not.toHaveBeenCalled();
    });

    it('Caso I: Should allow deleting a custom role without users', async () => {
      jest.spyOn(prisma.role, 'findUnique').mockResolvedValue({
        id: 'normal-role',
        isSystem: false,
      } as any);
      jest.spyOn(prisma.user, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.role, 'delete').mockResolvedValue({ id: 'normal-role' } as any);

      const result = await service.remove('normal-role', actor);

      expect(result.message).toBe('Rol eliminado exitosamente');
      expect(prisma.role.delete).toHaveBeenCalledWith({
        where: { id: 'normal-role' },
        select: expect.any(Object),
      });
      expect(cacheManager.del).toHaveBeenCalledWith('role_normal-role_access');
    });
  });
});
