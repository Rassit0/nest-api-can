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
import { ChargesService } from './charges.service';
import { CreateChargeDto } from './dto/create-charge.dto';
import { UpdateChargeDto } from './dto/update-charge.dto';
import { ChargesPaginationDto } from './dto/pagination.dto';
import { AddAdjustmentDto } from './dto/add-adjustment.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { ChargeResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Charges')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('charges')
export class ChargesController {
  constructor(private readonly chargesService: ChargesService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un nuevo cargo de facturación',
    description:
      'Registra una obligación de cobro base en el sistema con su descripción, fecha de vencimiento y monto total.',
  })
  @ApiStandardCreatedResponse(
    ChargeResponseDto,
    'Cargo base registrado con éxito.',
  )
  @RequirePermissions('CREATE_CHARGES')
  async create(@Body() createChargeDto: CreateChargeDto) {
    return await this.chargesService.create(createChargeDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista paginada de cargos',
    description:
      'Retorna una lista paginada y filtrable de todos los cargos de facturación cargados.',
  })
  @ApiPaginatedResponse(
    ChargeResponseDto,
    'Lista de cargos obtenida correctamente.',
  )
  @RequirePermissions('READ_CHARGES')
  async findAll(@Query() paginationDto: ChargesPaginationDto) {
    return await this.chargesService.findAll(paginationDto);
  }

  @Patch(':id/adjustment')
  @ApiOperation({
    summary: 'Agregar ajuste a un cargo',
    description: 'Aplica un recargo o descuento específico a un cargo existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del cargo (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: AddAdjustmentDto })
  @ApiStandardResponse(ChargeResponseDto, 'Ajuste agregado exitosamente.')
  @RequirePermissions('UPDATE_CHARGES')
  async addAdjustment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addAdjustmentDto: AddAdjustmentDto,
  ) {
    return await this.chargesService.addAdjustment(id, addAdjustmentDto);
  }

  @Delete(':id/adjustment')
  @ApiOperation({
    summary: 'Eliminar ajuste de un cargo',
    description: 'Remueve el ajuste aplicado a un cargo específico.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del cargo (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(ChargeResponseDto, 'Ajuste eliminado exitosamente.')
  @RequirePermissions('DELETE_CHARGES')
  async removeAdjustment(@Param('id', ParseUUIDPipe) id: string) {
    return await this.chargesService.removeAdjustment(id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles de un cargo por ID',
    description:
      'Busca y retorna los metadatos y estado de pago (PENDING, PAID, etc.) de un cargo específico por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del cargo a consultar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(ChargeResponseDto, 'Cargo encontrado exitosamente.')
  @RequirePermissions('READ_CHARGES')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.chargesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar detalles de un cargo',
    description:
      'Actualiza los campos editables de un cargo o realiza un enlace relacional a un cargo padre de forma segura.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del cargo a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateChargeDto })
  @ApiStandardResponse(ChargeResponseDto, 'Cargo actualizado exitosamente.')
  @RequirePermissions('UPDATE_CHARGES')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateChargeDto: UpdateChargeDto,
  ) {
    return await this.chargesService.update(id, updateChargeDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un cargo',
    description:
      'Elimina de manera definitiva un cargo de facturación y las dependencias asociadas.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del cargo a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(ChargeResponseDto, 'Cargo eliminado exitosamente.')
  @RequirePermissions('DELETE_CHARGES')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.chargesService.remove(id);
  }
}
