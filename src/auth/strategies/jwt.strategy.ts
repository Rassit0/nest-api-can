import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { envs } from 'src/config';
import { User } from 'src/generated/prisma/client';
import { JwtPayload } from '../interfaces/jwt.payload.interface';
import { PrismaService } from 'src/prisma.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: envs.jwtSecret,
    });
  }

  async validate(
    payload: JwtPayload,
  ): Promise<Partial<User> & { roleId: string }> {
    const { id, roleId, email } = payload;

    // Consulta ultraligera, ya no unimos roles ni permisos
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
        email: true,
        roleId: true,
      },
    });

    if (!user) throw new UnauthorizedException('Token no válido');

    if (!user.isActive) throw new UnauthorizedException('Usuario no activo');

    // Guardamos el ID en el contexto de CLS para que PrismaService lo use en la auditoría
    this.cls.set('userId', user.id);

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      roleId: user.roleId, // Utilizar roleId de la BD y no del payload
    };
  }
}
