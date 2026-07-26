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

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: authSelect,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Credenciales no válidas o usuario inactivo.',
      );
    }

    if (!bcrypt.compareSync(password, user.password)) {
      throw new UnauthorizedException('Credenciales no válidas.');
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
  }

  private getJwtToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }
}
