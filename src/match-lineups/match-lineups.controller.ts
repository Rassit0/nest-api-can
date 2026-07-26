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
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { MatchLineupsService } from './match-lineups.service';
import { CreateMatchLineupDto } from './dto/create-match-lineup.dto';
import { UpdateMatchLineupDto } from './dto/update-match-lineup.dto';
import { MatchLineupsPaginationDto } from './dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { MatchLineupResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Match Lineups')
@Controller('match-lineups')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class MatchLineupsController {
  constructor(private readonly matchLineupsService: MatchLineupsService) {}

  @Post()
  @ApiOperation({ summary: 'Convocar un jugador a un partido' })
  @RequirePermissions('CREATE_MATCH_LINEUPS')
  async create(@Body() createMatchLineupDto: CreateMatchLineupDto) {
    return await this.matchLineupsService.create(createMatchLineupDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener convocados y sus estadísticas de juego' })
  @RequirePermissions('READ_MATCH_LINEUPS')
  async findAll(@Query() paginationDto: MatchLineupsPaginationDto) {
    return await this.matchLineupsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de una convocatoria por ID' })
  @RequirePermissions('READ_MATCH_LINEUPS')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.matchLineupsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar estadísticas o detalles de un convocado',
  })
  @ApiBody({ type: UpdateMatchLineupDto })
  @RequirePermissions('UPDATE_MATCH_LINEUPS')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMatchLineupDto: UpdateMatchLineupDto,
  ) {
    return await this.matchLineupsService.update(id, updateMatchLineupDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar a un jugador de la convocatoria' })
  @RequirePermissions('DELETE_MATCH_LINEUPS')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.matchLineupsService.remove(id);
  }
}
