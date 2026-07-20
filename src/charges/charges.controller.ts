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
import { ChargesService } from './charges.service';
import { CreateChargeDto } from './dto/create-charge.dto';
import { UpdateChargeDto } from './dto/update-charge.dto';
import { ChargesPaginationDto } from './dto/pagination.dto';
import { AddDiscountDto } from './dto/add-discount.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { ChargeResponseDto } from '../common/dto/responses/entities.dto';

@ApiTags('Charges')
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
  async findAll(@Query() paginationDto: ChargesPaginationDto) {
    return await this.chargesService.findAll(paginationDto);
  }

  @Patch(':id/discount')
  @ApiOperation({
    summary: 'Agregar descuento a un cargo',
    description: 'Aplica un descuento específico a un cargo existente.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del cargo (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: AddDiscountDto })
  @ApiStandardResponse(ChargeResponseDto, 'Descuento agregado exitosamente.')
  async addDiscount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addDiscountDto: AddDiscountDto,
  ) {
    return await this.chargesService.addDiscount(id, addDiscountDto);
  }

  @Delete(':id/discount')
  @ApiOperation({
    summary: 'Eliminar descuento de un cargo',
    description: 'Remueve el descuento aplicado a un cargo específico.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del cargo (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(ChargeResponseDto, 'Descuento eliminado exitosamente.')
  async removeDiscount(@Param('id', ParseUUIDPipe) id: string) {
    return await this.chargesService.removeDiscount(id);
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
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.chargesService.remove(id);
  }
}
