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
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PlayerPaginationDto } from './dto/pagination.dto';
import { FormDataRequest } from 'nestjs-form-data';
import { ApiBody } from '@nestjs/swagger';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) { }

  @Post()
  async create(@Body() createPlayerDto: CreatePlayerDto) {
    return await this.playersService.create(createPlayerDto);
  }

  @Get()
  async findAll(@Query() paginationDto: PlayerPaginationDto) {
    return await this.playersService.findAll(paginationDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.playersService.findOne(id);
  }

  @Patch(':id')
  @ApiBody({ type: UpdatePlayerDto })
  @FormDataRequest()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlayerDto: UpdatePlayerDto,
  ) {
    return await this.playersService.update(id, updatePlayerDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.playersService.remove(id);
  }
}
