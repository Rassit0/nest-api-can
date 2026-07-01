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
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersPaginationDto } from './dto/pagination.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un nuevo usuario',
    description:
      'Crea las credenciales de acceso para un correo asignando un rol y vinculando opcionalmente un perfil de persona.',
  })
  @ApiCreatedResponse({
    description:
      'Usuario creado exitosamente con la contraseña encriptada SHA-256.',
  })
  @ApiBadRequestResponse({
    description: 'El correo electrónico ya existe o el rol asignado no existe.',
  })
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de usuarios',
    description:
      'Retorna una lista paginada y filtrable de todos los usuarios registrados en la plataforma.',
  })
  @ApiOkResponse({ description: 'Lista de usuarios obtenida correctamente.' })
  async findAll(@Query() paginationDto: UsersPaginationDto) {
    return await this.usersService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un usuario por ID',
    description:
      'Busca y retorna la información de seguridad de un usuario específico junto con su persona y rol.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario a consultar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Usuario encontrado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El usuario solicitado no existe.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un usuario específico',
    description:
      'Modifica datos de credenciales, rol o vinculación a persona de un usuario por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ description: 'Usuario actualizado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El usuario solicitado no existe.' })
  @ApiBadRequestResponse({
    description:
      'El correo nuevo ya está registrado por otro usuario o datos inválidos.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un usuario',
    description:
      'Elimina de manera permanente la cuenta de usuario del sistema.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Usuario eliminado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El usuario solicitado no existe.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usersService.remove(id);
  }
}
