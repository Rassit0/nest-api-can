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
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchesPaginationDto } from './dto/pagination.dto';
import { ApiStandardResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { MatchResponseDto } from '../common/dto/responses/entities.dto';

@ApiTags('Matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar/programar un partido' })
  async create(@Body() createMatchDto: CreateMatchDto) {
    return await this.matchesService.create(createMatchDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener lista de partidos' })
  async findAll(@Query() paginationDto: MatchesPaginationDto) {
    return await this.matchesService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de un partido por ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.matchesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar detalles o resultado de un partido' })
  @ApiBody({ type: UpdateMatchDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMatchDto: UpdateMatchDto,
  ) {
    return await this.matchesService.update(id, updateMatchDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un partido' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.matchesService.remove(id);
  }
}
