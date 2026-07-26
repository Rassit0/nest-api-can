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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InstitutionsService } from './institutions.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { InstitutionsPaginationDto } from './dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { InstitutionResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Institutions')
@Controller('institutions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post()
  @RequirePermissions('CREATE_INSTITUTIONS')
  async create(@Body() createInstitutionDto: CreateInstitutionDto) {
    return await this.institutionsService.create(createInstitutionDto);
  }

  @Get()
  @RequirePermissions('READ_INSTITUTIONS')
  async findAll(@Query() paginationDto: InstitutionsPaginationDto) {
    return await this.institutionsService.findAll(paginationDto);
  }

  @Get('default')
  @ApiOperation({
    summary: 'Obtener la institución principal (Público)',
    description:
      'Devuelve la única institución registrada en el sistema con todos sus datos y contactos para mostrar en el portal web.',
  })
  @ApiStandardResponse(
    InstitutionResponseDto,
    'Institución principal obtenida exitosamente.',
  )
  @RequirePermissions('READ_INSTITUTIONS')
  async findDefault() {
    return await this.institutionsService.findDefault();
  }

  @Get(':id')
  @RequirePermissions('READ_INSTITUTIONS')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.institutionsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('UPDATE_INSTITUTIONS')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInstitutionDto: UpdateInstitutionDto,
  ) {
    return await this.institutionsService.update(id, updateInstitutionDto);
  }

  @Delete(':id')
  @RequirePermissions('DELETE_INSTITUTIONS')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.institutionsService.remove(id);
  }
}
