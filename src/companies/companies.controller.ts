import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseBoolPipe,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaginationDto } from '../common/dto/pagination';

@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @RequirePermissions('CREATE_COMPANIES')
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  @Get()
  @RequirePermissions('READ_COMPANIES')
  findAll(@Query('isActive') isActive?: string) {
    let parsedIsActive: boolean | undefined;
    if (isActive !== undefined) {
      parsedIsActive = isActive === 'true';
    }
    return this.companiesService.findAll(parsedIsActive);
  }

  @Get('options')
  @RequirePermissions('READ_COMPANIES', 'CREATE_ACCOUNT_CHARGES', 'READ_TRANSACTIONS')
  getOptions(@Query() paginationDto: PaginationDto) {
    return this.companiesService.getOptions(paginationDto);
  }

  @Get(':id')
  @RequirePermissions('READ_COMPANIES')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('UPDATE_COMPANIES')
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companiesService.update(id, updateCompanyDto);
  }
}
