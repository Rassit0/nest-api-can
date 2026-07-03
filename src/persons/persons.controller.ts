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

@ApiTags('Persons')
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
  async findAll(@Query() paginationDto: PersonPaginationDto) {
    return await this.personsService.findAll(paginationDto);
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
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.personsService.remove(id);
  }
}
