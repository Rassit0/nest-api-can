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
import { StudentDiscountsService } from './student-discounts.service';
import { CreateStudentDiscountDto } from './dto/create-student-discount.dto';
import { UpdateStudentDiscountDto } from './dto/update-student-discount.dto';
import { StudentDiscountsPaginationDto } from './dto/pagination.dto';

@ApiTags('Student Discounts')
@Controller('student-discounts')
export class StudentDiscountsController {
  constructor(
    private readonly studentDiscountsService: StudentDiscountsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Asignar un descuento/beca a una inscripción escolar',
    description:
      'Registra un descuento porcentual para mensualidades y matrícula de una inscripción escolar activa.',
  })
  @ApiCreatedResponse({
    description: 'Descuento registrado y aplicado exitosamente.',
  })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  async create(@Body() createStudentDiscountDto: CreateStudentDiscountDto) {
    return await this.studentDiscountsService.create(createStudentDiscountDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de descuentos escolares',
    description:
      'Retorna una lista paginada y filtrable de todas las becas y descuentos vigentes.',
  })
  @ApiOkResponse({ description: 'Lista de descuentos obtenida correctamente.' })
  async findAll(@Query() paginationDto: StudentDiscountsPaginationDto) {
    return await this.studentDiscountsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles de un descuento por ID',
    description:
      'Busca y retorna la información parametrizada de una beca/descuento por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la beca a consultar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Descuento escolar encontrado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El descuento solicitado no existe.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.studentDiscountsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar vigencia o porcentajes de un descuento',
    description:
      'Modifica la vigencia temporal o el porcentaje de deducción de una beca por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la beca a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateStudentDiscountDto })
  @ApiOkResponse({ description: 'Descuento escolar actualizado con éxito.' })
  @ApiNotFoundResponse({ description: 'El descuento solicitado no existe.' })
  @ApiBadRequestResponse({ description: 'Datos incorrectos.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStudentDiscountDto: UpdateStudentDiscountDto,
  ) {
    return await this.studentDiscountsService.update(
      id,
      updateStudentDiscountDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un descuento escolar',
    description:
      'Remueve de forma definitiva el descuento aplicado a la inscripción.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del descuento a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Descuento escolar eliminado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El descuento solicitado no existe.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.studentDiscountsService.remove(id);
  }
}
