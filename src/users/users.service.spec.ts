import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from 'src/prisma.service';
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';

describe('UsersService (Security)', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
            role: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn(async (cb) => {
              // Simulated transaction execution
              return cb({
                user: {
                  count: prisma.user.count,
                  update: prisma.user.update,
                },
              });
            }),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('Last SuperAdmin Protection', () => {
    const actor = { id: 'admin-id' };
    const superAdminUser = {
      id: 'target-id',
      email: 'super@admin.com',
      isActive: true,
      roleId: 'super-role-id',
      role: { isSuperAdmin: true },
    };

    it('Caso A: Should forbid deactivating the last active SuperAdmin', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(superAdminUser as any);
      jest.spyOn(prisma.user, 'count').mockResolvedValue(0); // 0 remaining OTHER superadmins

      await expect(service.deactivate('target-id', actor)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.deactivate('target-id', actor)).rejects.toThrow(
        'Operación abortada: El sistema quedaría sin Super Administradores activos'
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('Caso B: Should allow deactivating if there is another active SuperAdmin', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(superAdminUser as any);
      jest.spyOn(prisma.user, 'count').mockResolvedValue(1); // 1 OTHER superadmin active
      jest.spyOn(prisma.user, 'update').mockResolvedValue({ ...superAdminUser, isActive: false } as any);

      const result = await service.deactivate('target-id', actor);

      expect(result.message).toBe('Usuario desactivado exitosamente');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'target-id' },
        data: { isActive: false },
        select: expect.any(Object),
      });
    });

    it('Caso C: Should forbid changing the role of the last active SuperAdmin', async () => {
      const updateDto = { roleId: 'new-role-id' };
      const nonSuperAdminRole = { id: 'new-role-id', isSuperAdmin: false };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(superAdminUser as any);
      jest.spyOn(prisma.role, 'findUnique').mockResolvedValue(nonSuperAdminRole as any);
      jest.spyOn(prisma.user, 'count').mockResolvedValue(0); // 0 OTHER superadmins

      await expect(service.update('target-id', updateDto, actor)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.update('target-id', updateDto, actor)).rejects.toThrow(
        'Operación abortada: El sistema quedaría sin Super Administradores activos'
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
