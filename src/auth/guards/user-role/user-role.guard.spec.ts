import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRoleGuard } from './user-role.guard';
import { PrismaService } from 'src/prisma.service';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { MODULES_KEY } from '../../decorators/modules.decorator';

describe('UserRoleGuard (Targeted Regression Suite)', () => {
  let guard: UserRoleGuard;
  let reflector: Reflector;
  let prisma: PrismaService;
  let cacheManager: any;

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRoleGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            role: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    guard = module.get<UserRoleGuard>(UserRoleGuard);
    reflector = module.get<Reflector>(Reflector);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const createMockContext = (user: any): ExecutionContext => {
    const request = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('1. endpoint without permission decorator: allows access and attaches user.permissions to request', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined); // No @RequirePermissions, no @RequireModules

    cacheManager.get.mockResolvedValueOnce({
      permissions: ['READ_FINANCIAL_ACCOUNTS', 'READ_CHARGES'],
      modules: ['FINANCIAL'],
    });

    const user: any = { id: 'u-1', roleId: 'role-123' };
    const context = createMockContext(user);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    // Request context enrichment must be present for downstream controllers/services
    expect(user.permissions).toEqual(['READ_FINANCIAL_ACCOUNTS', 'READ_CHARGES']);
  });

  it('2. endpoint with required permission granted: allows access and populates permissions', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['READ_AUDIT_LOGS'];
      return undefined;
    });

    cacheManager.get.mockResolvedValueOnce({
      permissions: ['READ_AUDIT_LOGS', 'READ_DASHBOARD'],
      modules: ['AUDIT'],
    });

    const user: any = { id: 'u-2', roleId: 'role-admin' };
    const context = createMockContext(user);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(user.permissions).toContain('READ_AUDIT_LOGS');
  });

  it('3. endpoint with required permission denied: throws ForbiddenException 403', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['CREATE_TRANSACTIONS'];
      return undefined;
    });

    cacheManager.get.mockResolvedValueOnce({
      permissions: ['READ_DASHBOARD'],
      modules: ['DASHBOARD'],
    });

    const user: any = { id: 'u-3', roleId: 'role-readonly' };
    const context = createMockContext(user);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('4. permissions attached to request/user: loads from Prisma when cache misses', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    cacheManager.get.mockResolvedValueOnce(undefined); // Cache miss
    (prisma.role.findUnique as jest.Mock).mockResolvedValueOnce({
      permissions: [
        { permission: { name: 'READ_MATCHES', module: { name: 'MATCHES' } } },
      ],
    });

    const user: any = { id: 'u-4', roleId: 'role-sports' };
    const context = createMockContext(user);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(user.permissions).toEqual(['READ_MATCHES']);
    expect(cacheManager.set).toHaveBeenCalledWith(
      'role_role-sports_access',
      { permissions: ['READ_MATCHES'], modules: ['MATCHES'] },
      3600000,
    );
  });

  it('5. no role-name bypass: user with role SUPER_ADMIN but lacking exact permission is rejected', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['SPECIAL_SECURITY_PERMISSION'];
      return undefined;
    });

    // Even if user object or role has name "SUPER_ADMIN", guard checks roleAccess.permissions strictly
    cacheManager.get.mockResolvedValueOnce({
      permissions: ['READ_ALL', 'WRITE_ALL'],
      modules: ['ALL'],
    });

    const user: any = { id: 'u-5', roleId: 'role-superadmin', role: 'SUPER_ADMIN' };
    const context = createMockContext(user);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('6. no MANAGE_ALL fallback: wildcard does not implicitly satisfy specific permission unless explicit', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['DELETE_USERS'];
      return undefined;
    });

    // Only has other permissions, not DELETE_USERS
    cacheManager.get.mockResolvedValueOnce({
      permissions: ['READ_USERS', 'UPDATE_USERS'],
      modules: ['USERS'],
    });

    const user: any = { id: 'u-6', roleId: 'role-manager' };
    const context = createMockContext(user);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
