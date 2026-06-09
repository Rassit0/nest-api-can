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
import { PlayerPassesService } from './player-passes.service';
import { CreatePlayerPassDto } from './dto/create-player-pass.dto';
import { UpdatePlayerPassDto } from './dto/update-player-pass.dto';
import { PlayerPassesPaginationDto } from './dto/pagination.dto';
import { FormDataRequest } from 'nestjs-form-data';
import { GetTeamsByClubOptionsDto } from './dto/get-teams-by-club-options.dto';

@Controller('player-passes')
export class PlayerPassesController {
  constructor(private readonly playerPassesService: PlayerPassesService) {}

  @Post()
  @FormDataRequest()
  async create(@Body() createPlayerPassDto: CreatePlayerPassDto) {
    return await this.playerPassesService.create(createPlayerPassDto);
  }

  @Get()
  async findAll(@Query() paginationDto: PlayerPassesPaginationDto) {
    return await this.playerPassesService.findAll(paginationDto);
  }

  @Get('player/:playerId')
  playerPassesByPlayerId(
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @Query() paginationDto: PlayerPassesPaginationDto,
  ) {
    return this.playerPassesService.playerPassesByPlayerId(
      playerId,
      paginationDto,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.playerPassesService.findOne(id);
  }

  @Get('active/options')
  async getPlayerPassActiveOptions() {
    return await this.playerPassesService.getPlayerPassActiveOptions();
  }

  @Get('clubs/options/:disciplineId')
  async getClubsOptions(
    @Param('disciplineId', ParseUUIDPipe) disciplineId: string,
  ) {
    return await this.playerPassesService.getClubsByDisciplineOptions(
      disciplineId,
    );
  }

  @Get('disciplines/options')
  async getDisciplinesOptions() {
    return await this.playerPassesService.getDisciplinesOptions();
  }

  @Get('active/options/:playerId/:disciplineId')
  async getActivePassesByPlayerByDisciplineOptions(
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @Param('disciplineId', ParseUUIDPipe) disciplineId: string,
  ) {
    return await this.playerPassesService.getPlayerPassActiveByPlayerByDisciplineOptions(
      playerId,
      disciplineId,
    );
  }

  @Get('teams/options/:clubId')
  async getTeamsOptions(
    @Param('clubId', ParseUUIDPipe) clubId: string,
    @Query() filter: GetTeamsByClubOptionsDto,
  ) {
    return await this.playerPassesService.getTeamsByClubByGenderOptions(
      clubId,
      filter.gender,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlayerPassDto: UpdatePlayerPassDto,
  ) {
    return this.playerPassesService.update(id, updatePlayerPassDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.playerPassesService.remove(id);
  }
}
