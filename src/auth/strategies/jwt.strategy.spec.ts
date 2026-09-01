import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from 'src/prisma.service';
import { ClsService } from 'nestjs-cls';
import { UnauthorizedException } from '@nestjs/common';
import { envs } from 'src/config';

describe('JwtStrategy (Security)', () => {
  let strategy: JwtStrategy;
  let prisma: PrismaService;
  let cls: ClsService;

  beforeAll(() => {
    envs.jwtSecret = 'test-secret';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ClsService,
          useValue: {
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prisma = module.get<PrismaService>(PrismaService);
    cls = module.get<ClsService>(ClsService);
  });

  it('Caso J: Should return roleId from DB, ignoring the one in JWT payload', async () => {
    const payload = { id: 'user-id', email: 'test@test.com', roleId: 'old-role-id' };
    
    // DB returns a DIFFERENT roleId
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-id',
      email: 'test@test.com',
      isActive: true,
      roleId: 'new-role-id',
    } as any);

    const result = await strategy.validate(payload as any);

    expect(result.roleId).toBe('new-role-id');
    expect(result.roleId).not.toBe('old-role-id');
  });

  it('Caso K: Should throw UnauthorizedException if DB says isActive = false, even if JWT is valid', async () => {
    const payload = { id: 'user-id', email: 'test@test.com', roleId: 'role-id' };
    
    // DB returns isActive = false
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-id',
      email: 'test@test.com',
      isActive: false,
      roleId: 'role-id',
    } as any);

    await expect(strategy.validate(payload as any)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(strategy.validate(payload as any)).rejects.toThrow(
      'Usuario no activo',
    );
  });
});
