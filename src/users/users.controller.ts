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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersPaginationDto } from './dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { UserResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un nuevo usuario',
    description:
      'Crea las credenciales de acceso para un correo asignando un rol y vinculando opcionalmente un perfil de persona.',
  })
  @ApiStandardCreatedResponse(
    UserResponseDto,
    'Usuario creado exitosamente con la contraseña encriptada SHA-256.',
  )
  @RequirePermissions('CREATE_USERS')
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de usuarios',
    description:
      'Retorna una lista paginada y filtrable de todos los usuarios registrados en la plataforma.',
  })
  @ApiPaginatedResponse(
    UserResponseDto,
    'Lista de usuarios obtenida correctamente.',
  )
  @RequirePermissions('READ_USERS')
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
  @ApiStandardResponse(UserResponseDto, 'Usuario encontrado exitosamente.')
  @RequirePermissions('READ_USERS')
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
  @ApiStandardResponse(UserResponseDto, 'Usuario actualizado exitosamente.')
  @RequirePermissions('UPDATE_USERS')
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
  @ApiStandardResponse(UserResponseDto, 'Usuario eliminado exitosamente.')
  @RequirePermissions('DELETE_USERS')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usersService.remove(id);
  }
}
