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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoriesPaginationDto } from './dto/pagination.dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una categoría',
    description:
      'Registra una categoría por rangos de edad y género permitidos.',
  })
  @ApiCreatedResponse({ description: 'Categoría creada con éxito.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return await this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar categorías',
    description:
      'Retorna una lista paginada y filtrable de todas las categorías.',
  })
  @ApiOkResponse({ description: 'Lista de categorías obtenida correctamente.' })
  async findAll(@Query() paginationDto: CategoriesPaginationDto) {
    return await this.categoriesService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener categoría por ID',
    description: 'Busca y retorna los metadatos completos de una categoría.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la categoría (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Categoría encontrada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La categoría no existe.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar categoría por ID',
    description: 'Modifica los parámetros de edad o género de una categoría.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la categoría a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiOkResponse({ description: 'Categoría actualizada con éxito.' })
  @ApiNotFoundResponse({ description: 'La categoría no existe.' })
  @ApiBadRequestResponse({ description: 'Datos incorrectos.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return await this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar categoría por ID',
    description: 'Remueve de forma permanente una categoría.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la categoría a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Categoría eliminada con éxito.' })
  @ApiNotFoundResponse({ description: 'La categoría no existe.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.categoriesService.remove(id);
  }
}
