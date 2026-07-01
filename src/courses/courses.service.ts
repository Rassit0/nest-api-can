import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { CoursesPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const courseSelect: Prisma.CourseSelect = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
  school: {
    select: {
      id: true,
      name: true,
      institution: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
};

@Injectable()
export class CoursesService {
  private readonly logger = new Logger('CoursesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createCourseDto: CreateCourseDto) {
    const newCourse = await this.prisma.course.create({
      data: createCourseDto,
      select: courseSelect,
    });

    return {
      message: 'Curso escolar creado exitosamente',
      data: newCourse,
    };
  }

  async findAll(paginationDto: CoursesPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'name',
      schoolId,
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.CourseWhereInput = {};

    if (schoolId) {
      where.schoolId = schoolId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        {
          school: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [courses, totalItems] = await Promise.all([
      this.prisma.course.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: courseSelect,
      }),
      this.prisma.course.count({ where }),
    ]);

    return createPaginationResult(
      courses,
      totalItems,
      page,
      per_page,
      'Cursos obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: courseSelect,
    });
    if (!course) {
      throw new NotFoundException('El curso solicitado no fue encontrado');
    }
    return {
      message: 'Curso obtenido exitosamente',
      data: course,
    };
  }

  async update(id: string, updateCourseDto: UpdateCourseDto) {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });
    if (!course) {
      throw new NotFoundException('El curso solicitado no fue encontrado');
    }

    const updatedCourse = await this.prisma.course.update({
      where: { id },
      data: updateCourseDto,
      select: courseSelect,
    });

    return {
      message: 'Curso actualizado exitosamente',
      data: updatedCourse,
    };
  }

  async remove(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });
    if (!course) {
      throw new NotFoundException('El curso solicitado no fue encontrado');
    }

    const deletedCourse = await this.prisma.course.delete({
      where: { id },
      select: courseSelect,
    });

    return {
      message: 'Curso eliminado exitosamente',
      data: deletedCourse,
    };
  }
}
