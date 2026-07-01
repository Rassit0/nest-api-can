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
import { ApiStandardResponse, ApiStandardCreatedResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { CategoryResponseDto } from '../common/dto/responses/entities.dto';

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
  @ApiStandardCreatedResponse(CategoryResponseDto, 'Categoría creada con éxito.')
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return await this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar categorías',
    description:
      'Retorna una lista paginada y filtrable de todas las categorías.',
  })
  @ApiPaginatedResponse(CategoryResponseDto, 'Lista de categorías obtenida correctamente.')
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
  @ApiStandardResponse(CategoryResponseDto, 'Categoría encontrada exitosamente.')
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
  @ApiStandardResponse(CategoryResponseDto, 'Categoría actualizada con éxito.')
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
  @ApiStandardResponse(CategoryResponseDto, 'Categoría eliminada con éxito.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.categoriesService.remove(id);
  }
}
