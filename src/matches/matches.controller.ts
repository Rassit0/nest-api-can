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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchesPaginationDto } from './dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { MatchResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Matches')
@Controller('matches')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar/programar un partido' })
  @RequirePermissions('CREATE_MATCHES')
  async create(@Body() createMatchDto: CreateMatchDto, @Req() req: any) {
    const userId = req.user?.id;
    return await this.matchesService.create(createMatchDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener lista de partidos' })
  @RequirePermissions('READ_MATCHES')
  async findAll(@Query() paginationDto: MatchesPaginationDto) {
    return await this.matchesService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de un partido por ID' })
  @RequirePermissions('READ_MATCHES')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.matchesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar detalles o resultado de un partido' })
  @ApiBody({ type: UpdateMatchDto })
  @RequirePermissions('UPDATE_MATCHES')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMatchDto: UpdateMatchDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return await this.matchesService.update(id, updateMatchDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un partido' })
  @RequirePermissions('DELETE_MATCHES')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.matchesService.remove(id);
  }
}
