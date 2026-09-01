import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from 'src/prisma.service';
import { UsersModule } from 'src/users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { envs } from 'src/config';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrismaService, JwtStrategy],
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: envs.jwtSecret,
      signOptions: { expiresIn: '10h' },
    }),
  ],
  exports: [JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}
