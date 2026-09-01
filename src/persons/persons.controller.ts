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
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PersonsService } from './persons.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonPaginationDto } from './dto/pagination.dto';
import { FormDataRequest } from 'nestjs-form-data';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { PersonResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

import { SecretarySummaryResponseDto } from './dto/secretary-summary.dto';

@ApiTags('Persons')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una persona',
    description:
      'Registra el perfil base de una persona en el sistema con foto y datos de contacto.',
  })
  @ApiConsumes('multipart/form-data')
  @FormDataRequest()
  @ApiStandardCreatedResponse(PersonResponseDto, 'Persona creada exitosamente.')
  @RequirePermissions('CREATE_PERSONS')
  async create(@Body() createPersonDto: CreatePersonDto) {
    return await this.personsService.create(createPersonDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar personas',
    description:
      'Retorna una lista paginada y filtrable de todos los perfiles de personas.',
  })
  @ApiPaginatedResponse(
    PersonResponseDto,
    'Lista de personas obtenida correctamente.',
  )
  @RequirePermissions('READ_PERSONS')
  async findAll(@Query() paginationDto: PersonPaginationDto) {
    return await this.personsService.findAll(paginationDto);
  }

  @Get(':id/secretary-summary')
  @ApiOperation({
    summary: 'Obtener resumen de secretaría por ID de persona',
    description:
      'Retorna un resumen integral para la secretaria: Perfil, membresías activas y cargos pendientes.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la persona (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    SecretarySummaryResponseDto,
    'Resumen de secretaría obtenido exitosamente.',
  )
  @RequirePermissions('READ_PERSONS')
  async getSecretarySummary(@Param('id', ParseUUIDPipe) id: string) {
    return await this.personsService.getSecretarySummary(id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener persona por ID',
    description:
      'Retorna la información personal completa de una persona por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la persona (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(PersonResponseDto, 'Persona encontrada exitosamente.')
  @RequirePermissions('READ_PERSONS')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.personsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar persona por ID',
    description: 'Modifica datos de perfil o foto de una persona.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la persona a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiConsumes('multipart/form-data')
  @FormDataRequest()
  @ApiBody({ type: UpdatePersonDto })
  @ApiStandardResponse(
    PersonResponseDto,
    'Datos de persona actualizados con éxito.',
  )
  @RequirePermissions('UPDATE_PERSONS')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePersonDto: UpdatePersonDto,
  ) {
    return await this.personsService.update(id, updatePersonDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar persona por ID',
    description: 'Remueve de forma permanente el perfil de persona.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la persona a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(PersonResponseDto, 'Persona eliminada exitosamente.')
  @RequirePermissions('DELETE_PERSONS')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.personsService.remove(id);
  }
}
