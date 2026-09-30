import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Prisma } from '../generated/prisma/client';
import { PaginationDto } from '../common/dto/pagination';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCompanyDto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: createCompanyDto,
    });
  }

  async findAll(isActive?: boolean) {
    const where: Prisma.CompanyWhereInput = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    return this.prisma.company.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async getOptions(paginationDto: PaginationDto) {
    const { per_page = 10, page = 1, search } = paginationDto;
    const skip = (page - 1) * per_page;
    
    const searchTerms = search ? search.trim().split(/\s+/) : [];

    const where: Prisma.CompanyWhereInput = {
      ...(searchTerms.length > 0
        ? {
            AND: searchTerms.map((term) => ({
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { taxId: { contains: term, mode: 'insensitive' } },
              ],
            })),
          }
        : {}),
      isActive: true,
    };

    const [companies, totalItems] = await Promise.all([
      this.prisma.company.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { name: 'asc' },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      data: companies.map((company) => ({
        id: company.id,
        name: company.name,
        taxId: company.taxId,
        isActive: company.isActive,
      })),
      meta: {
        totalItems,
        itemCount: companies.length,
        itemsPerPage: per_page,
        totalPages: Math.ceil(totalItems / per_page),
        currentPage: page,
      },
    };
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });
    if (!company) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }
    return company;
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto) {
    await this.findOne(id); // Check exists
    return this.prisma.company.update({
      where: { id },
      data: updateCompanyDto,
    });
  }
}
