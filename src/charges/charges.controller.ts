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
  @ApiCreatedResponse({ description: 'Cargo base registrado con éxito.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  async create(@Body() createChargeDto: CreateChargeDto) {
    return await this.chargesService.create(createChargeDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista paginada de cargos',
    description:
      'Retorna una lista paginada y filtrable de todos los cargos de facturación cargados.',
  })
  @ApiOkResponse({ description: 'Lista de cargos obtenida correctamente.' })
  async findAll(@Query() paginationDto: ChargesPaginationDto) {
    return await this.chargesService.findAll(paginationDto);
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
  @ApiOkResponse({ description: 'Cargo encontrado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El cargo solicitado no existe.' })
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
  @ApiOkResponse({ description: 'Cargo actualizado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El cargo solicitado no existe.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada incorrectos.' })
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
  @ApiOkResponse({ description: 'Cargo eliminado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El cargo solicitado no existe.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.chargesService.remove(id);
  }
}
