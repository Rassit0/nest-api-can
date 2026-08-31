import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { TeamSeasonCategoryService } from './team-season-category.service';
import { CreateTeamSeasonCategoryDto } from './dto/create-team-season-category.dto';
import { UpdateTeamSeasonCategoryDto } from './dto/update-team-season-category.dto';
import { FinishEarlyTeamSeasonCategoryDto } from './dto/finish-early-team-season-category.dto';
import { ApiStandardResponse } from '../common/decorators/api-responses.decorator';

@ApiTags('Team Season Categories')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('team-seasons/:teamSeasonId/categories')
export class TeamSeasonCategoryController {
  constructor(
    private readonly teamSeasonCategoryService: TeamSeasonCategoryService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Añadir una nueva categoría a un TeamSeason' })
  @RequirePermissions('UPDATE_TEAM_SEASONS')
  @ApiStandardResponse(Object)
  create(
    @Param('teamSeasonId', ParseUUIDPipe) teamSeasonId: string,
    @Body() createDto: CreateTeamSeasonCategoryDto,
  ) {
    return this.teamSeasonCategoryService.create(teamSeasonId, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar categorías de un TeamSeason' })
  @RequirePermissions('READ_TEAM_SEASONS')
  @ApiStandardResponse(Object)
  findAll(@Param('teamSeasonId', ParseUUIDPipe) teamSeasonId: string) {
    return this.teamSeasonCategoryService.findAllByTeamSeason(teamSeasonId);
  }

  @Get(':categoryId')
  @ApiOperation({ summary: 'Obtener una categoría de un TeamSeason' })
  @RequirePermissions('READ_TEAM_SEASONS')
  @ApiStandardResponse(Object)
  findOne(
    @Param('teamSeasonId', ParseUUIDPipe) teamSeasonId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.teamSeasonCategoryService.findOne(teamSeasonId, categoryId);
  }

  @Patch(':categoryId')
  @ApiOperation({ summary: 'Actualizar una categoría' })
  @RequirePermissions('UPDATE_TEAM_SEASONS')
  @ApiStandardResponse(Object)
  update(
    @Param('teamSeasonId', ParseUUIDPipe) teamSeasonId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() updateDto: UpdateTeamSeasonCategoryDto,
  ) {
    return this.teamSeasonCategoryService.update(
      teamSeasonId,
      categoryId,
      updateDto,
    );
  }

  @Patch(':categoryId/activate')
  @ApiOperation({ summary: 'Activar una categoría' })
  @RequirePermissions('UPDATE_TEAM_SEASONS')
  @ApiStandardResponse(Object)
  activate(
    @Param('teamSeasonId', ParseUUIDPipe) teamSeasonId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.teamSeasonCategoryService.activate(teamSeasonId, categoryId);
  }

  @Patch(':categoryId/deactivate')
  @ApiOperation({ summary: 'Desactivar una categoría' })
  @RequirePermissions('UPDATE_TEAM_SEASONS')
  @ApiStandardResponse(Object)
  deactivate(
    @Param('teamSeasonId', ParseUUIDPipe) teamSeasonId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.teamSeasonCategoryService.deactivate(teamSeasonId, categoryId);
  }

  @Post(':categoryId/finish-early')
  @ApiOperation({ summary: 'Finalizar anticipadamente una categoría' })
  @RequirePermissions('UPDATE_TEAM_SEASONS')
  @ApiStandardResponse(Object)
  finishEarly(
    @Param('teamSeasonId', ParseUUIDPipe) teamSeasonId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: FinishEarlyTeamSeasonCategoryDto,
  ) {
    return this.teamSeasonCategoryService.finishEarly(categoryId, dto);
  }
}
