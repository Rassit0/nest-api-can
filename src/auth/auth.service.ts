import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { LoginUserDto } from './dto/login-user.dto';
import { PrismaService } from 'src/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './interfaces/jwt.payload.interface';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from 'src/generated/prisma/client';

export const authSelect = {
  id: true,
  email: true,
  password: true,
  isActive: true,
  role: {
    select: {
      id: true,
      name: true,
      permissions: {
        select: {
          permission: {
            select: {
              name: true,
              module: {
                select: {
                  name: true,
                  displayName: true,
                  icon: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      },
    },
  },
  person: {
    select: {
      id: true,
      name: true,
      lastName: true,
      email: true,
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginUserDto: LoginUserDto) {
    const { password, email } = loginUserDto;

    const MAX_LOGIN_ATTEMPTS = 3;
    const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

    const result = await this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<any[]>`
        SELECT id, failed_login_attempts, locked_until, is_active, password
        FROM users
        WHERE email = ${email}
        FOR UPDATE
      `;

      if (users.length === 0) {
        return { error: 'Credenciales no válidas.' };
      }

      const userRow = users[0];

      if (!userRow.is_active) {
        return { error: 'Credenciales no válidas.' };
      }

      if (userRow.locked_until && userRow.locked_until > new Date()) {
        return { error: 'Credenciales no válidas.' };
      }

      if (!bcrypt.compareSync(password, userRow.password)) {
        const newAttempts = userRow.failed_login_attempts + 1;
        let newLockedUntil = null;
        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          newLockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        }

        await tx.user.update({
          where: { id: userRow.id },
          data: {
            failedLoginAttempts: newAttempts,
            lockedUntil: newLockedUntil,
          },
        });

        // Always return generic message to prevent enumeration
        return { error: 'Credenciales no válidas.' };
      }

      if (userRow.failed_login_attempts > 0 || userRow.locked_until) {
        await tx.user.update({
          where: { id: userRow.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });
      }

      const user = await tx.user.findUnique({
        where: { id: userRow.id },
        select: authSelect,
      });

      if (!user) {
        return { error: 'Credenciales no válidas.' };
      }

      const token = this.getJwtToken({
        id: user.id,
        email: user.email,
        roleId: user.role.id,
      });

      // Mapeamos los módulos únicos por nombre para aplanar la respuesta en el token
      const modulesMap = new Map();
      user.role?.permissions?.forEach((p) => {
        const mod = p.permission.module;
        if (mod && !modulesMap.has(mod.name)) {
          modulesMap.set(mod.name, mod.name);
        }
      });

      const modulesList = Array.from(modulesMap.values());

      // Extraemos el password y el objeto role para no devolverlos
      const { password: _, role, ...userWithoutPassword } = user as any;

      const flattenedUser = {
        ...userWithoutPassword,
        roleId: role?.id,
        modules: modulesList,
      };

      return {
        message: 'Ingreso exitoso',
        data: {
          token,
          user: flattenedUser,
        },
      };
    });

    if (result.error) {
      throw new UnauthorizedException(result.error);
    }
    return result;
  }

  private getJwtToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }
}
