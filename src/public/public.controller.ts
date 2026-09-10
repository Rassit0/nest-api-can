import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { InstitutionsService } from '../institutions/institutions.service';
import { TeamSeasonService } from '../team-season/team-season.service';
import { CourseSeasonsService } from '../course-seasons/course-seasons.service';
import { MatchesService } from '../matches/matches.service';
import { NewsService } from '../news/news.service';
import { BannersService } from '../banners/banners.service';

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly institutionsService: InstitutionsService,
    private readonly teamSeasonService: TeamSeasonService,
    private readonly courseSeasonsService: CourseSeasonsService,
    private readonly matchesService: MatchesService,
    private readonly newsService: NewsService,
    private readonly bannersService: BannersService,
  ) {}

  @Get('institutions/default')
  @ApiOperation({
    summary: 'Obtener la institución principal (Público)',
    description: 'Devuelve información segura de la institución para el portal web.',
  })
  @ApiOkResponse({ description: 'Institución principal obtenida exitosamente.' })
  async findDefaultInstitution() {
    return await this.institutionsService.findDefault();
  }

  @Get('team-seasons')
  @ApiOperation({
    summary: 'Listar equipos públicos',
    description: 'Retorna información pública de los equipos para el portal web.',
  })
  @ApiOkResponse({ description: 'Equipos públicos obtenidos correctamente.' })
  async findPublicTeamSeasons(@Query('isHistorical') isHistorical?: string) {
    const historical = isHistorical === 'true';
    return await this.teamSeasonService.findPublic(historical);
  }

  @Get('course-seasons')
  @ApiOperation({
    summary: 'Listar cursos de formación públicos',
    description: 'Retorna información pública de las escuelas/cursos para el portal web.',
  })
  @ApiOkResponse({ description: 'Cursos públicos obtenidos correctamente.' })
  async findPublicCourseSeasons() {
    return await this.courseSeasonsService.findPublic();
  }

  @Get('matches/fixture')
  @ApiOperation({
    summary: 'Listar fixture público de partidos',
    description: 'Retorna los próximos partidos y resultados recientes para el portal web.',
  })
  @ApiOkResponse({ description: 'Fixture público obtenido correctamente.' })
  async findPublicFixture() {
    return await this.matchesService.findPublicFixture();
  }

  @Get('news')
  @ApiOperation({
    summary: 'Listar noticias públicas',
    description: 'Retorna listado de noticias publicadas para el portal web.',
  })
  @ApiOkResponse({ description: 'Noticias públicas obtenidas correctamente.' })
  async findPublicNews() {
    return await this.newsService.findPublic();
  }

  @Get('news/:slug')
  @ApiOperation({
    summary: 'Obtener detalle de una noticia pública',
    description: 'Retorna los detalles de una noticia publicada según su slug.',
  })
  @ApiOkResponse({ description: 'Detalle de noticia obtenido correctamente.' })
  async findPublicNewsBySlug(@Param('slug') slug: string) {
    return await this.newsService.findPublicBySlug(slug);
  }

  @Get('banners')
  @ApiOperation({
    summary: 'Listar banners públicos',
    description: 'Retorna listado de banners activos ordenados para el portal web.',
  })
  @ApiOkResponse({ description: 'Banners públicos obtenidos correctamente.' })
  async findPublicBanners() {
    return await this.bannersService.findPublic();
  }
}

