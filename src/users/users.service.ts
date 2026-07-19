import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { UsersPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export const userSelect: Prisma.UserSelect = {
  id: true,
  email: true,
  isActive: true,
  personId: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
  person: {
    select: {
      id: true,
      name: true,
      lastName: true,
      phone: true,
      email: true,
    },
  },
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger('UsersService');

  constructor(private readonly prisma: PrismaService) {}

  private hashPassword(password: string): string {
    // Encripta el
    return bcrypt.hashSync(password, 10);
  }

  async create(createUserDto: CreateUserDto) {
    const {
      email,
      password,
      confirmPassword: _,
      personId,
      roleId,
    } = createUserDto;

    // Verificar si el correo ya existe
    const exists = await this.prisma.user.findUnique({
      where: { email },
    });
    if (exists) {
      throw new BadRequestException('errors.EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = this.hashPassword(password);

    const newUser = await this.prisma.user.create({
      data: {
        email,
        password: passwordHash,
        personId,
        roleId,
      },
      select: userSelect,
    });

    return {
      message: 'Usuario creado exitosamente',
      data: newUser,
    };
  }

  async findAll(paginationDto: UsersPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'email',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        {
          person: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          role: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [users, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: userSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return createPaginationResult(
      users,
      totalItems,
      page,
      per_page,
      'Usuarios obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) {
      throw new NotFoundException('errors.USER_NOT_FOUND');
    }
    return {
      message: 'Usuario obtenido exitosamente',
      data: user,
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException('errors.USER_NOT_FOUND');
    }

    const { email, password, personId, roleId } = updateUserDto;

    // Verificar unicidad de email si se actualiza
    if (email && email !== user.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email },
      });
      if (emailExists) {
        throw new BadRequestException('errors.EMAIL_ALREADY_EXISTS');
      }
    }

    const data: Prisma.UserUpdateInput = {
      email,
    };

    if (personId !== undefined) {
      if (personId === null) {
        data.person = { disconnect: true };
      } else {
        data.person = { connect: { id: personId } };
      }
    }

    if (roleId !== undefined) {
      data.role = { connect: { id: roleId } };
    }

    if (password) {
      data.password = this.hashPassword(password);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    return {
      message: 'Usuario actualizado exitosamente',
      data: updatedUser,
    };
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException('errors.USER_NOT_FOUND');
    }

    const deletedUser = await this.prisma.user.delete({
      where: { id },
      select: userSelect,
    });

    return {
      message: 'Usuario eliminado exitosamente',
      data: deletedUser,
    };
  }
}
