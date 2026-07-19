import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InstitutionsService } from './institutions.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { InstitutionsPaginationDto } from './dto/pagination.dto';
import { ApiStandardResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { InstitutionResponseDto } from '../common/dto/responses/entities.dto';

@ApiTags('Institutions')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post()
  async create(@Body() createInstitutionDto: CreateInstitutionDto) {
    return await this.institutionsService.create(createInstitutionDto);
  }

  @Get()
  async findAll(@Query() paginationDto: InstitutionsPaginationDto) {
    return await this.institutionsService.findAll(paginationDto);
  }

  @Get('default')
  @ApiOperation({
    summary: 'Obtener la institución principal (Público)',
    description: 'Devuelve la única institución registrada en el sistema con todos sus datos y contactos para mostrar en el portal web.',
  })
  @ApiStandardResponse(InstitutionResponseDto, 'Institución principal obtenida exitosamente.')
  async findDefault() {
    return await this.institutionsService.findDefault();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.institutionsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInstitutionDto: UpdateInstitutionDto,
  ) {
    return await this.institutionsService.update(id, updateInstitutionDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.institutionsService.remove(id);
  }
}
