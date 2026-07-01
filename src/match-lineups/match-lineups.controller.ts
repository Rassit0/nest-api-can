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
import { MatchLineupsService } from './match-lineups.service';
import { CreateMatchLineupDto } from './dto/create-match-lineup.dto';
import { UpdateMatchLineupDto } from './dto/update-match-lineup.dto';
import { MatchLineupsPaginationDto } from './dto/pagination.dto';
import { ApiStandardResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { MatchLineupResponseDto } from '../common/dto/responses/entities.dto';

@ApiTags('Match Lineups')
@Controller('match-lineups')
export class MatchLineupsController {
  constructor(private readonly matchLineupsService: MatchLineupsService) {}

  @Post()
  @ApiOperation({ summary: 'Convocar un jugador a un partido' })
  async create(@Body() createMatchLineupDto: CreateMatchLineupDto) {
    return await this.matchLineupsService.create(createMatchLineupDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener convocados y sus estadísticas de juego' })
  async findAll(@Query() paginationDto: MatchLineupsPaginationDto) {
    return await this.matchLineupsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de una convocatoria por ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.matchLineupsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar estadísticas o detalles de un convocado',
  })
  @ApiBody({ type: UpdateMatchLineupDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMatchLineupDto: UpdateMatchLineupDto,
  ) {
    return await this.matchLineupsService.update(id, updateMatchLineupDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar a un jugador de la convocatoria' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.matchLineupsService.remove(id);
  }
}
