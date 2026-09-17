import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { InstitutionsService } from '../institutions/institutions.service';
import { TeamSeasonService } from '../team-season/team-season.service';
import { CourseSeasonsService } from '../course-seasons/course-seasons.service';
import { MatchesService } from '../matches/matches.service';
import { NewsService } from '../news/news.service';
import { HeroBannersService } from '../hero-banners/hero-banners.service';
import { HomeDisciplinesService } from '../home-disciplines/home-disciplines.service';
import { NewsCategoriesService } from '../news-categories/news-categories.service';
import { PromotionsService } from '../promotions/promotions.service';

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly institutionsService: InstitutionsService,
    private readonly teamSeasonService: TeamSeasonService,
    private readonly courseSeasonsService: CourseSeasonsService,
    private readonly matchesService: MatchesService,
    private readonly newsService: NewsService,
    private readonly heroBannersService: HeroBannersService,
    private readonly homeDisciplinesService: HomeDisciplinesService,
    private readonly newsCategoriesService: NewsCategoriesService,
    private readonly promotionsService: PromotionsService,
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

  @Get('news-categories')
  @ApiOperation({
    summary: 'Listar categorías de noticias públicas',
    description: 'Retorna las categorías activas de noticias para el portal web.',
  })
  @ApiOkResponse({ description: 'Categorías de noticias públicas obtenidas correctamente.' })
  async findPublicNewsCategories() {
    return await this.newsCategoriesService.findActive();
  }

  @Get('news')
  @ApiOperation({
    summary: 'Listar noticias públicas',
    description: 'Retorna listado de noticias publicadas para el portal web.',
  })
  @ApiOkResponse({ description: 'Noticias públicas obtenidas correctamente.' })
  async findPublicNews(
    @Query('categoryId') categoryId?: string,
    @Query('limit') limit?: string,
  ) {
    const limitNumber = limit ? parseInt(limit, 10) : undefined;
    const finalLimit = limitNumber && !isNaN(limitNumber) ? limitNumber : undefined;
    return await this.newsService.findPublic(categoryId, finalLimit);
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

  @Get('hero-banners')
  @ApiOperation({
    summary: 'Listar hero banners públicos',
    description: 'Retorna listado de hero banners activos ordenados para el portal web.',
  })
  @ApiOkResponse({ description: 'Hero Banners públicos obtenidos correctamente.' })
  async findPublicHeroBanners() {
    const all = await this.heroBannersService.findAll();
    return all.filter(b => b.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  @Get('home-disciplines')
  @ApiOperation({
    summary: 'Listar home disciplines públicos',
    description: 'Retorna listado de disciplinas de inicio activas ordenadas para el portal web.',
  })
  @ApiOkResponse({ description: 'Home Disciplines públicos obtenidos correctamente.' })
  async findPublicHomeDisciplines() {
    const all = await this.homeDisciplinesService.findAll();
    return all.filter(d => d.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  @Get('promotions')
  @ApiOperation({
    summary: 'Obtener promociones públicas',
    description: 'Retorna las promociones activas (PROMO_1 y PROMO_2) para el portal web.',
  })
  @ApiOkResponse({ description: 'Promociones obtenidas correctamente.' })
  async findPublicPromotions() {
    return await this.promotionsService.findPublic();
  }
}

